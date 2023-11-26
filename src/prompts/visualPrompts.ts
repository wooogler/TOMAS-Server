import { simplifyItemHtml } from "../utils/htmlHandler";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { ActionComponent, ScreenResult } from "../utils/pageHandler";
import { JSDOM } from "jsdom";
import { Action } from "../utils/parsingAgent";

export async function extractTextLabelFromHTML(
  itemHtml: string,
  screenDescription: string
) {
  const simpleItemHtml = simplifyItemHtml(itemHtml);

  const makeTextLabelPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `Generate the text label for the given HTML element.

Description of the section where the element is located:
${screenDescription}

HTML of the element:
${simpleItemHtml}`,
    },
  ];
  return await getAiResponse(makeTextLabelPrompts);
}

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

async function getAttrFromList(listHtml: string, screenDescription: string) {
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
  const jsonString = await getGpt4Response([getAttrFromListPrompts]);
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

  return Array.from(allAttributes);
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

    const attrList = await getAttrFromList(listHtml, screenDescription);

    async function extractInfoFromAction(action: Action) {
      const simpleActionHtml = removeAllElementsWithoutText(action.html);
      const extractInfoPrompt: Prompt = {
        role: "SYSTEM",
        content: `Given a HTML snippet, extract key information in a structured JSON format.

HTML Snippet:
${simpleActionHtml}

Extract and format the information in one-level JSON as follows:

Output: 
{
  ${attrList.map((attr) => `"${attr}": {${attr}} or null`).join(",\n")}
}
`,
      };
      const jsonString = await getAiResponse([extractInfoPrompt]);
      const jsonObject = JSON.parse(jsonString);
      return jsonObject;
    }

    results = await Promise.all(actions.map(extractInfoFromAction));
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

  console.log(data);
  return data;
}
