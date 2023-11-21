import { JSDOM } from "jsdom";
import { Prompt, getAiResponse } from "./langchainHandler";
import { extractSurroundingHtml, simplifyHtml } from "./htmlHandler";
import { extractTextLabelFromHTML } from "../prompts/visualPrompts";
import { loadCacheFromFile, saveCacheToFile } from "./fileUtil";
import {
  selectActionTemplate,
  singleActionTemplate,
  tableActionTemplate,
} from "../prompts/screenPrompts";
import {
  makeElementDescriptionPrompt,
  makeListDescriptionPrompt,
  makeQuestionPrompt,
  makeSelectQuestionPrompt,
  translateQuestionTemplate,
} from "../prompts/chatPrompts";
import { Page } from "puppeteer";

export interface ActionableElement {
  i: string;
  type: string;
  element: Element;
}

export interface Action {
  type: string;
  content: string;
  question?: string;
  description?: string;
  i: number;
  html: string;
  options?: string[];
}

export async function parsingListAgent({ listHtml }: { listHtml: string }) {
  const dom = new JSDOM(listHtml);
  const listElement = dom.window.document.body.firstElementChild as Element;
  const itemElements = Array.from(listElement.children);
  const itemActions: Action[] = await itemElements.reduce(
    async (prevPromise, itemElement) => {
      const prevActions = await prevPromise;
      const clickableElements = findClickableElements(itemElement);
      const itemText = itemElement.textContent?.replace(/\s+/g, " ").trim();
      const itemI = itemElement.getAttribute("i");
      if (clickableElements.length > 0) {
        prevActions.push({
          type: "focus",
          content: itemText || "",
          question: `Do you want to select ${itemText}?`,
          i: Number(itemI),
          html: simplifyHtml(itemElement.outerHTML, true),
        });
      }
      return prevActions;
    },
    Promise.resolve([] as Action[])
  );

  return itemActions;
}

export async function parsingItemAgentOriginal({
  screenHtml,
  screenDescription,
}: {
  screenHtml: string;
  screenDescription: string;
}): Promise<Action[]> {
  const dom = new JSDOM(screenHtml);
  const screen = dom.window.document.body as Element;
  const itemElements = Array.from(screen.firstElementChild?.children || []);
  const itemActions: Action[] = await itemElements.reduce(
    async (prevPromise, itemElement) => {
      const prevActions = await prevPromise;
      const actions = await parsingAgent({
        screenHtml: itemElement.outerHTML,
        screenDescription,
      });

      if (actions.length > 1) {
        const textLabel = await extractTextLabelFromHTML(
          itemElement.outerHTML,
          screenDescription
        );
        const itemI = itemElement.getAttribute("i");
        prevActions.push({
          type: "focus",
          content: `label-${textLabel}`,
          question: `Do you want to select ${textLabel}?`,
          i: Number(itemI),
          html: simplifyHtml(itemElement.outerHTML, true),
        });
      } else if (actions.length === 1) {
        const action = actions[0];
        prevActions.push(action);
      }
      return prevActions;
    },
    Promise.resolve([] as Action[])
  );

  return itemActions;
}

export async function parsingItemAgent({
  elementHtml,
  screenDescription,
}: {
  elementHtml: string;
  screenDescription: string;
}) {
  const dom = new JSDOM(elementHtml);
  const element = dom.window.document.body as Element;
  const actionableElements: ActionableElement[] = [];

  const clickableElements = findClickableElements(element);
  clickableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "click",
      element,
    });
  });

  const actions = await getActions(
    actionableElements,
    element,
    screenDescription
  );

  return actions.sort((a, b) => a.i - b.i);
}

export async function parsingAgent({
  screenHtml,
  screenDescription,
}: {
  screenHtml: string;
  screenDescription: string;
}): Promise<Action[]> {
  const dom = new JSDOM(screenHtml);
  let screen = dom.window.document.body as Element;
  let originalScreen = screen.cloneNode(true) as Element;
  const actionableElements: ActionableElement[] = [];

  const selectableElements = findSelectableElements(screen);
  selectableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "select",
      element,
    });
  });
  screen = removeElementsFromScreen(screen, selectableElements);

  const clickableElements = findClickableElements(screen);
  clickableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "click",
      element,
    });
  });
  screen = removeElementsFromScreen(screen, clickableElements);

  const inputableElements = findInputableElements(screen);
  inputableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "input",
      element,
    });
  });

  const actions = await getActions(
    actionableElements,
    originalScreen,
    screenDescription
  );

  return actions.sort((a, b) => a.i - b.i);
}

function findSelectableElements(screen: Element): Element[] {
  const elements: Element[] = [];
  const selectableTagNames = ["ul", "ol", "select", "fieldset", "table"];
  const excludeClassKeywords = ["mask", "section", "swiper", "bot"];

  // Traverse the DOM and find all selectable elements
  function traverseAndFind(element: Element) {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "div") {
      const frequencyMap = createFrequencyMap(element, excludeClassKeywords);

      for (const frequency of frequencyMap.values()) {
        if (frequency >= 2) {
          elements.push(element);
          break;
        }
      }
    } else if (selectableTagNames.includes(tagName)) {
      // If the element is a selectable tag, add it to the list of selectable elements
      elements.push(element);
    }

    for (const childElement of element.children) {
      traverseAndFind(childElement);
    }
  }
  traverseAndFind(screen);

  // Remove elements that are contained within other elements
  const repeatedElements = elements.filter((element, _, arr) => {
    return !arr.some(
      (otherElement) =>
        element !== otherElement && otherElement.contains(element)
    );
  });

  const selectableElements = repeatedElements.filter((element, _, arr) => {
    let countClickable = 0;
    const childElements = Array.from(element.children);
    for (const childElement of childElements) {
      findClickableElements(childElement).forEach(() => countClickable++);
    }
    return countClickable > arr.length / 2;
  });

  return selectableElements;
}

// Create a map of the frequency of each attribute
function createFrequencyMap(
  element: Element,
  excludeKeywords: string[]
): Map<string, number> {
  const frequencyMap: Map<string, number> = new Map();

  for (const childElement of element.children) {
    // Add the element's classes to the frequency map
    for (const className of childElement.classList) {
      if (!excludeKeywords.some((keyword) => className.includes(keyword))) {
        frequencyMap.set(className, (frequencyMap.get(className) || 0) + 1);
      }
    }

    // Add the element's attributes to the frequency map
    for (const attr of childElement.attributes) {
      if (attr.name.startsWith("data-")) {
        const attrKey = `${attr.name}=${attr.value}`;
        frequencyMap.set(attrKey, (frequencyMap.get(attrKey) || 0) + 1);
      }
    }
  }
  return frequencyMap;
}

// Find all clickable elements
export function findClickableElements(screen: Element): Element[] {
  const clickableTagNames = ["a", "button", "input"];
  const clickableElements = Array.from(
    screen.querySelectorAll(clickableTagNames.join(","))
  ).filter((element) => {
    if (element.tagName.toLowerCase() === "input") {
      const inputType = element.getAttribute("type");
      const clickableType = ["button", "submit", "radio", "checkbox"];
      return clickableType.includes(inputType || "");
    }
    return true;
  });

  const clickableDivs = Array.from(
    screen.querySelectorAll('div[clickable="true"]')
  ).filter((div) => {
    for (const clickableElement of clickableElements) {
      if (div.contains(clickableElement)) {
        return false;
      }
    }
    return true;
  });

  return [...clickableElements, ...clickableDivs];
}

// Find all inputable elements
function findInputableElements(screen: Element): Element[] {
  const inputableTagNames = ["input", "textarea"];
  const inputableElements = Array.from(
    screen.querySelectorAll(inputableTagNames.join(","))
  ).filter((element) => {
    if (element.tagName.toLowerCase() === "input") {
      const inputType = element.getAttribute("type");
      const nonInputableTypes = [
        "button",
        "submit",
        "reset",
        "image",
        "checkbox",
        "radio",
      ];
      if (nonInputableTypes.includes(inputType || "")) {
        return false;
      }
    }

    if (element.hasAttribute("readonly")) return false;

    return true;
  });

  return inputableElements;
}

// Remove elements from the screen
function removeElementsFromScreen(
  screen: Element,
  elements: Element[]
): Element {
  for (const element of elements) {
    const i = element.getAttribute("i");
    if (i) {
      const elementToRemove = screen.querySelector(`[i="${i}"]`);
      elementToRemove?.parentNode?.removeChild(elementToRemove);
    }
  }
  return screen;
}

async function getActions(
  actionableElements: ActionableElement[],
  screenElement: Element,
  screenDescription: string
): Promise<Action[]> {
  const actionCache = new ActionCache("actionCache.json");
  const actionsPromises = actionableElements.map((elem) =>
    processElement(elem, screenElement, screenDescription, actionCache)
  );

  const actions = await Promise.all(actionsPromises);
  actionCache.save();
  return actions;
}

async function processElement(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string,
  actionCache: ActionCache
): Promise<Action> {
  const identifier = generateIdentifier(elem.element?.outerHTML || "");
  let action = actionCache.get(identifier);
  if (!action) {
    action = await createAction(elem, screenElement, screenDescription);
    actionCache.set(identifier, action);
  }
  return action;
}

async function createAction(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string
): Promise<Action> {
  const element = elem.element;
  if (!elem.element) {
    throw new Error("Element is null");
  }

  const elementTagName = element.tagName.toLowerCase();

  if (elem.type === "select" && elementTagName !== "table") {
    return await createSelectAction(elem, screenElement, screenDescription);
  } else {
    return await createSingleAction(elem, screenElement, screenDescription);
  }
}

async function createSelectAction(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string
): Promise<Action> {
  const { content, question, description, options } =
    await getAiResponseForSelectAction(elem, screenElement, screenDescription);

  return {
    type: "select",
    i: Number(elem.i),
    content,
    question,
    description,
    html: simplifyHtml(elem.element.outerHTML, true, true),
    options,
  };
}

async function createSingleAction(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string
): Promise<Action> {
  const { content, question, description } = await getAiResponseForSingleAction(
    elem,
    screenElement,
    screenDescription
  );

  return {
    type: elem.type,
    i: Number(elem.i),
    content,
    question,
    description,
    html: simplifyHtml(elem.element.outerHTML, true),
  };
}

async function extractOptions(
  element: Element,
  screenDescription: string
): Promise<string[]> {
  const optionElements = Array.from(element.children);
  return optionElements.map((option) => {
    // 텍스트에서 개행, 탭 제거 및 연속된 공백을 단일 공백으로 변환
    return option.textContent?.replace(/\s+/g, " ").trim() || "";
  });
}

async function getAiResponseForSelectAction(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string
) {
  const options = await extractOptions(elem.element, screenDescription);
  const element = elem.element;
  const firstChildClone = element.children[0].cloneNode(true) as Element;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  element.appendChild(firstChildClone);
  const firstItemWithParentHtml = simplifyHtml(element.outerHTML, true, true);
  const selectActionPrompt = selectActionTemplate({
    options,
    firstItemWithParentHtml,
    screenDescription,
  });
  const content = await getAiResponse([selectActionPrompt]);
  const question = await getAiResponse([
    selectActionPrompt,
    { role: "AI", content: content },
    makeSelectQuestionPrompt(),
  ]);
  const description = await getAiResponse([
    selectActionPrompt,
    { role: "AI", content: content },
    makeSelectQuestionPrompt(),
    { role: "AI", content: question },
    makeListDescriptionPrompt(),
  ]);

  return { content, question, description, options };
}

async function getAiResponseForSingleAction(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string
) {
  const element = elem.element;
  const tableActionPrompt: Prompt = tableActionTemplate({
    screenDescription,
    simplifiedElementHtml: simplifyHtml(element.outerHTML, true),
    simplifiedScreenHtml: simplifyHtml(screenElement.outerHTML, true),
  });
  const singleActionPrompt: Prompt = singleActionTemplate({
    actionType: elem.type,
    screenDescription,
    simplifiedElementHtml: simplifyHtml(element.outerHTML, true),
    simplifiedScreenHtml: simplifyHtml(screenElement.outerHTML, true),
  });
  const actionPrompt =
    element.tagName.toLowerCase() === "table"
      ? tableActionPrompt
      : singleActionPrompt;
  const content = await getAiResponse([actionPrompt]);
  const question = await getAiResponse([
    actionPrompt,
    { role: "AI", content: content },
    makeQuestionPrompt(),
  ]);
  const description = await getAiResponse([
    actionPrompt,
    { role: "AI", content: content },
    makeQuestionPrompt(),
    { role: "AI", content: question },
    makeElementDescriptionPrompt(),
  ]);

  return { content, question, description };
}

class ActionCache {
  private cache: Map<string, object>;
  private cacheFileName: string;

  constructor(cacheFileName: string) {
    this.cache = loadCacheFromFile(cacheFileName);
    this.cacheFileName = cacheFileName;
  }

  get(identifier: string): Action | undefined {
    return this.cache.get(identifier) as Action | undefined;
  }

  set(identifier: string, action: Action) {
    this.cache.set(identifier, action);
  }

  save() {
    saveCacheToFile(this.cache, this.cacheFileName);
  }
}

export function generateIdentifier(html: string): string {
  const dom = new JSDOM(html);
  const element = dom.window.document.body.firstElementChild as Element;

  const representativeAttributes = [
    "id",
    "class",
    "name",
    "role",
    "type",
    "aria-label",
    "href",
  ];
  let identifierComponents = [];
  identifierComponents.push(element.tagName.toLowerCase());
  if (element.textContent) {
    const cleanedText = element.textContent
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20);
    identifierComponents.push(cleanedText);
  }

  for (const attr of representativeAttributes) {
    const attrValue = element.getAttribute(attr);
    if (attrValue) {
      identifierComponents.push(`${attr}=${attrValue}`);
    }
  }
  return identifierComponents.join(",");
}

export default parsingAgent;
