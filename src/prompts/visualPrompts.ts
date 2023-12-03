import {
  generateIdentifier,
  simplifyHtml,
  simplifyItemHtml,
} from "../utils/htmlHandler";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { ActionComponent, ScreenResult } from "../utils/pageHandler";
import { JSDOM } from "jsdom";
import { Action } from "../agents/parsingAgent";
import { AttrCache, TableCache } from "../utils/fileUtil";

function removeAllElementsWithoutText(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // 모든 요소 순회
  const elements = document.querySelectorAll("*");

  elements.forEach((el) => {
    // textContent가 비어있는지 확인
    if (!el.textContent || el.textContent.trim() === "") {
      el.remove(); // textContent가 비어있다면 요소 제거
    } else if (el.tagName.toLowerCase() === "a") {
      el.removeAttribute("href"); // <a> 태그의 href 속성 제거
    }
    el.removeAttribute("clickable");
  });

  // 변경된 HTML 반환
  return document.body.innerHTML;
}

function createIdentifierFromTagStructure(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const rootElement = document.body.firstChild as HTMLElement;

  // 재귀적으로 태그 이름을 추출하는 함수
  function extractTagNames(element: HTMLElement | ChildNode): string {
    if (!element || element.nodeType !== dom.window.Node.ELEMENT_NODE) {
      return "";
    }

    const el = element as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    let identifier = tagName;

    // i와 div 태그를 제외한 태그의 클래스 이름 추가
    if (tagName !== "i" && tagName !== "div") {
      const classAttr = el.getAttribute("class");
      if (classAttr) {
        identifier += `.${classAttr.split(" ").join(".")}`;
      }
    }

    // 모든 자식 요소에 대해 재귀 호출
    element.childNodes.forEach((child) => {
      const childIdentifier = extractTagNames(child);
      if (childIdentifier) {
        identifier += `(${childIdentifier})`;
      }
    });

    return identifier;
  }

  return extractTagNames(rootElement);
}

function classifyHTMLsByStructure(htmls: string[]): Record<string, string[]> {
  const classifiedHTMLs: Record<string, string[]> = {};

  htmls.forEach((html) => {
    const identifier = createIdentifierFromTagStructure(html);

    if (!classifiedHTMLs[identifier]) {
      classifiedHTMLs[identifier] = [];
    }

    classifiedHTMLs[identifier].push(html);
  });

  return classifiedHTMLs;
}

async function translateAttributes(
  attributes: string[],
  screenDescription: string
): Promise<string[]> {
  const translatePrompts = attributes.map<Prompt>((attr) => {
    return {
      role: "SYSTEM",
      content: `Translate the following attribute to Korean based on screen.

Description of the screen: ${screenDescription}

English Attribute: ${attr}
Korean Translation:`,
    };
  });

  const translatedAttributes = await Promise.all(
    translatePrompts.map((item) => getAiResponse([item]))
  );
  return translatedAttributes;
}

async function getAttrFromList(listHtml: string, screenDescription: string) {
  const attrCache = new AttrCache("attrCache.json");
  const identifier = generateIdentifier(listHtml);
  const cachedAttr = attrCache.get(identifier);
  if (cachedAttr) {
    return cachedAttr;
  }
  const getAttrFromListPrompts: Prompt = {
    role: "SYSTEM",
    content: `Given multiple HTML snippets in a screen, extract key information and present it in a structured JSON Array format. Ignore any scripting, styling, or link/button elements.

Description of the list:
${screenDescription}

HTML Snippets:
${listHtml}

Extract and format the information in one-level JSON Array as follows:

Output: 
[
  {
      // Details extracted from the first snippet
  },
  {
      // Details extracted from the second snippet
  },
  ..
]

The output should be provided in a JSON array format that can be parsed.`,
  };
  console.log(getAttrFromListPrompts.content);
  const jsonString = await getGpt4Response([getAttrFromListPrompts]);
  console.log(jsonString);
  const regex = /\[\s*\{.*?\}\s*\]/gs;
  const match = jsonString.match(regex);
  const jsonArray = JSON.parse(match ? match[0] : "[]");

  const allAttributes = new Set<string>();
  jsonArray
    .filter((item: object) => Object.keys(item).length > 1)
    .forEach((json: Record<string, any>) => {
      const processObject = (
        obj: Record<string, any>,
        parentKey: string = ""
      ) => {
        Object.keys(obj).forEach((key) => {
          const fullKey = parentKey ? `${parentKey}_${key}` : key;
          if (obj[key] instanceof Object && !(obj[key] instanceof Array)) {
            processObject(obj[key], fullKey);
          } else {
            allAttributes.add(fullKey);
          }
        });
      };
      processObject(json);
    });

  const attributes = Array.from(allAttributes);
  const attributesKorean = await translateAttributes(
    attributes,
    screenDescription
  );

  const attributeMap: Record<string, string> = {};
  for (let i = 0; i < attributes.length; i++) {
    attributeMap[attributes[i]] = attributesKorean[i];
  }
  attrCache.set(identifier, attributeMap);
  attrCache.save();

  return attributeMap;
}

function hasOnlyOneTextContent(htmlString: string): boolean {
  const dom = new JSDOM(htmlString);

  function countTextNodes(node: Node): number {
    let count = 0;

    node.childNodes.forEach((child) => {
      if (
        child.nodeType === dom.window.Node.TEXT_NODE &&
        child.textContent &&
        child.textContent.trim().length > 0
      ) {
        count++;
      } else {
        count += countTextNodes(child);
      }
    });

    return count;
  }

  const textContentCount = countTextNodes(dom.window.document.body);

  return textContentCount === 1;
}

export async function getDataFromHTML(screen: ScreenResult) {
  const tableCache = new TableCache("tableCache.json");
  const { actions, screenDescription } = screen;

  const actionHtml = actions.map((action) => {
    return removeAllElementsWithoutText(action.html);
  });

  let results = [];

  if (hasOnlyOneTextContent(actionHtml[0])) {
    results = actions.map((action) => action.content);
  } else {
    const classified = classifyHTMLsByStructure(actionHtml);
    const listHtml = Object.values(classified)
      .map((item) => {
        return item[0];
      })
      .join("\n");

    const attrMap = await getAttrFromList(listHtml, screenDescription);

    async function extractInfoFromAction(action: Action) {
      const identifier = generateIdentifier(action.html);
      const cachedAction = tableCache.get(identifier);
      if (cachedAction) {
        return cachedAction;
      }

      const simpleActionHtml = simplifyHtml(action.html, true, true);
      const extractInfoPrompt: Prompt = {
        role: "SYSTEM",
        content: `Given a HTML snippet, extract key information in a structured JSON format.

HTML Snippet:
${simpleActionHtml}

Extract and format the information in one-level JSON as follows:

Output: 
{
${Object.keys(attrMap)
  .map((attr) => `  "${attr}": <${attr}>`)
  .join(",\n")}
}
`,
      };
      const jsonString = await getGpt4Response([extractInfoPrompt]);
      console.log(jsonString);

      const regex = /{.*?\}/gs;
      const match = jsonString.match(regex);
      const jsonObject = JSON.parse(match ? match[0] : "{}");

      tableCache.set(identifier, jsonObject);
      tableCache.save();

      return jsonObject;
    }

    results = await Promise.all(actions.map(extractInfoFromAction));
    results = results.map((item) => {
      const result: Record<string, any> = {};
      Object.keys(attrMap).forEach((attr) => {
        result[attrMap[attr]] = item[attr];
      });
      return result;
    });
  }

  const data = results.map((item, index) => {
    return {
      data: item,
      i: actions[index].i.toString(),
      description: actions[index].description,
      actionType: actions[index].type,
      content: actions[index].content,
    };
  });

  return data;
}

export async function getFilteredData(tableString: string, query: string) {
  const getFilteredDataPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given a JSON array of data, sort the array based on the user input.

JSON Array:
${tableString}

User Input:
${query}

Output the sorted array in a JSON array.`,
  };
  console.log(getFilteredDataPrompt.content);

  const jsonString = await getGpt4Response([getFilteredDataPrompt]);
  console.log(jsonString);
  const regex = /\[\s*\{.*?\}\s*\]/gs;
  const match = jsonString.match(regex);
  const jsonArray = JSON.parse(match ? match[0] : "[]");

  return jsonArray;
}
