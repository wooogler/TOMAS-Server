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
  makeQuestionTemplate,
  translateQuestionTemplate,
} from "../prompts/chatPrompts";

interface ActionableElement {
  i: string;
  type: string;
}

export interface Action {
  type: string;
  content: string;
  question?: string;
  i: number;
  html: string;
  options?: string[];
}

export async function parsingItemAgent({
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

export async function parsingAgent({
  screenHtml,
  screenDescription,
  scrollablesX,
  scrollablesY,
}: {
  screenHtml: string;
  screenDescription: string;
  scrollablesX?: string[];
  scrollablesY?: string[];
}): Promise<Action[]> {
  const dom = new JSDOM(screenHtml);
  let screen = dom.window.document.body as Element;
  let originalScreen = screen.cloneNode(true) as Element;
  const actionableElements: ActionableElement[] = [];

  // scrollablesX?.forEach((i) => {
  //   actionableElements.push({
  //     i,
  //     type: "scrollX",
  //   });
  // });

  // scrollablesY?.forEach((i) => {
  //   actionableElements.push({
  //     i,
  //     type: "scrollY",
  //   });
  // });

  const selectableElements = findSelectableElements(screen);
  selectableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "select",
    });
  });
  screen = removeElementsFromScreen(screen, selectableElements);

  const clickableElements = findClickableElements(screen);
  clickableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "click",
    });
  });
  screen = removeElementsFromScreen(screen, clickableElements);

  const inputableElements = findInputableElements(screen);
  inputableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "input",
    });
  });

  const actions = await getActions(
    actionableElements,
    originalScreen,
    screenDescription
  );

  return actions.sort((a, b) => a.i - b.i);
}

// function elementsToActions(element: Element, type: string): Action {}

function findSelectableElements(screen: Element): Element[] {
  const elements: Element[] = [];
  const selectableTagNames = ["ul", "ol", "select", "fieldset", "table"];

  // Traverse the DOM and find all selectable elements
  function traverseAndFind(element: Element) {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "div") {
      // If the element is a div, check if it has a child with a frequency of 3 or more
      const frequencyMap = createFrequencyMap(element);

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
  const selectableElements = elements.filter((element, _, arr) => {
    return !arr.some(
      (otherElement) =>
        element !== otherElement && otherElement.contains(element)
    );
  });

  return selectableElements;
}

// Create a map of the frequency of each attribute
function createFrequencyMap(element: Element): Map<string, number> {
  const frequencyMap: Map<string, number> = new Map();

  for (const childElement of element.children) {
    // Add the element's classes to the frequency map
    for (const className of childElement.classList) {
      if (!className.includes("mask") && !className.includes("section")) {
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
function findClickableElements(screen: Element): Element[] {
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
  const element = screenElement.querySelector(`[i="${elem.i}"]`);
  const identifier = generateIdentifier(element?.outerHTML || "");
  let action = actionCache.get(identifier);
  if (!action) {
    action = await createAction(elem, element, screenDescription);
    actionCache.set(identifier, action);
  }
  return action;
}

async function createAction(
  elem: ActionableElement,
  element: Element | null,
  screenDescription: string
): Promise<Action> {
  if (!element) {
    throw new Error("Element is null");
  }

  const simplifiedElementHtml = simplifyHtml(element.outerHTML, true);
  const elementTagName = element.tagName.toLowerCase();

  if (elem.type === "select" && elementTagName !== "table") {
    return await createSelectAction(
      elem,
      element,
      screenDescription,
      simplifiedElementHtml
    );
  } else {
    return await createSingleAction(
      elem,
      element,
      screenDescription,
      simplifiedElementHtml
    );
  }
}

async function createSelectAction(
  elem: ActionableElement,
  element: Element,
  screenDescription: string,
  simplifiedElementHtml: string
): Promise<Action> {
  const options = await extractOptions(element, screenDescription);
  const selectActionContent = await getAiResponseForSelectAction(
    options,
    element,
    screenDescription
  );
  const selectActionQuesion = await getAiResponseForQuestion(
    selectActionContent
  );
  const selectActionQuestionTranslation = await translateQuestion(
    selectActionQuesion
  );

  return {
    type: "select",
    i: Number(elem.i),
    content: selectActionContent,
    question: selectActionQuestionTranslation,
    html: simplifiedElementHtml,
    options,
  };
}

async function createSingleAction(
  elem: ActionableElement,
  element: Element,
  screenDescription: string,
  simplifiedElementHtml: string
): Promise<Action> {
  const actionContent = await getAiResponseForSingleAction(
    elem,
    element,
    screenDescription
  );
  const actionQuestion = await getAiResponseForQuestion(actionContent);
  const actionQuestionTranslation = await translateQuestion(actionQuestion);

  return {
    type: elem.type,
    i: Number(elem.i),
    content: actionContent,
    question: actionQuestionTranslation,
    html: simplifiedElementHtml,
  };
}

async function extractOptions(
  element: Element,
  screenDescription: string
): Promise<string[]> {
  const optionElements = Array.from(element.children);
  const optionsPromises = optionElements.map((optionElement) =>
    extractTextLabelFromHTML(optionElement.outerHTML, screenDescription)
  );
  return await Promise.all(optionsPromises);
}

async function getAiResponseForSelectAction(
  options: string[],
  element: Element,
  screenDescription: string
): Promise<string> {
  const optionElements = Array.from(element.children);
  const firstOptionHtml = simplifyHtml(optionElements[0].outerHTML, true);
  const selectActionPrompt = selectActionTemplate({
    options,
    firstOptionHtml,
    screenDescription,
  });
  return await getAiResponse([selectActionPrompt]);
}

async function getAiResponseForSingleAction(
  elem: ActionableElement,
  element: Element,
  screenDescription: string
): Promise<string> {
  const tableActionPrompt: Prompt = tableActionTemplate({
    screenDescription,
    simplifiedElementHtml: simplifyHtml(element.outerHTML, true),
    simplifiedScreenHtml: simplifyHtml(element.outerHTML, true),
  });
  const singleActionPrompt: Prompt = singleActionTemplate({
    actionType: elem.type,
    screenDescription,
    simplifiedElementHtml: simplifyHtml(element.outerHTML, true),
    simplifiedScreenHtml: simplifyHtml(element.outerHTML, true),
  });
  const actionPrompt =
    element.tagName.toLowerCase() === "table"
      ? tableActionPrompt
      : singleActionPrompt;
  return await getAiResponse([actionPrompt]);
}

async function getAiResponseForQuestion(content: string): Promise<string> {
  const makeQuestionPrompt: Prompt = makeQuestionTemplate();
  return await getAiResponse([
    { role: "AI", content: `Action: ${content}` },
    makeQuestionPrompt,
  ]);
}

async function translateQuestion(question: string): Promise<string> {
  const translateQuestionPrompt: Prompt = translateQuestionTemplate();
  return await getAiResponse([
    { role: "AI", content: `Question: ${question}` },
    translateQuestionPrompt,
  ]);
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

async function getActionsOriginal(
  actionableElements: ActionableElement[],
  screenElement: Element,
  screenDescription: string
): Promise<Action[]> {
  const cacheFileName = "actionCache.json";
  const actionCache = loadCacheFromFile(cacheFileName);

  const capitalizeFirstCharacter = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  const simplifiedScreenHtml = simplifyHtml(screenElement.outerHTML, true);
  const makeQuestionPrompt: Prompt = makeQuestionTemplate();
  const translateQuestionPrompt: Prompt = translateQuestionTemplate();

  const actionsPromises = actionableElements.map(async (elem) => {
    const element = screenElement.querySelector(`[i="${elem.i}"]`);
    const identifier = generateIdentifier(element?.outerHTML || "");

    let action = actionCache.get(identifier) as Action | undefined;

    if (action) {
      return action;
    }

    const elementTagName = element?.tagName.toLowerCase();
    const simplifiedElementHtml = simplifyHtml(element?.outerHTML || "", true);
    if (element && elem.type === "select" && elementTagName !== "table") {
      const optionElements = Array.from(element.children);
      const optionsPromises = optionElements.map((optionElement) =>
        extractTextLabelFromHTML(optionElement.outerHTML, screenDescription)
      );
      const options = await Promise.all(optionsPromises);

      const firstOptionHtml = simplifyHtml(optionElements[0].outerHTML, true);
      const selectActionPrompt = selectActionTemplate({
        options,
        firstOptionHtml,
        screenDescription,
      });
      const selectActionContent = await getAiResponse([selectActionPrompt]);
      const selectActionQuestion = await getAiResponse([
        selectActionPrompt,
        { role: "AI", content: `Action: ${selectActionContent}` },
        makeQuestionPrompt,
      ]);
      const selectActionQuestionTranslation = await getAiResponse([
        selectActionPrompt,
        { role: "AI", content: `Action: ${selectActionContent}` },
        makeQuestionPrompt,
        { role: "AI", content: `Question: ${selectActionQuestion}` },
        translateQuestionPrompt,
      ]);
      action = {
        type: "select",
        i: Number(elem.i),
        content: selectActionContent,
        question: selectActionQuestionTranslation,
        html: simplifiedElementHtml,
        options,
      };
    } else {
      const tableActionPrompt: Prompt = tableActionTemplate({
        screenDescription,
        simplifiedElementHtml,
        simplifiedScreenHtml,
      });
      const singleActionPrompt: Prompt = singleActionTemplate({
        actionType: capitalizeFirstCharacter(elem.type),
        screenDescription,
        simplifiedElementHtml,
        simplifiedScreenHtml,
      });
      const actionPrompt =
        elementTagName === "table" ? tableActionPrompt : singleActionPrompt;
      const actionContent = await getAiResponse([actionPrompt]);
      const actionQuestion = await getAiResponse([
        actionPrompt,
        { role: "AI", content: `Action: ${actionContent}` },
        makeQuestionPrompt,
      ]);
      const actionQuestionTranslation = await getAiResponse([
        actionPrompt,
        { role: "AI", content: `Action: ${actionContent}` },
        makeQuestionPrompt,
        { role: "AI", content: `Question: ${actionQuestion}` },
        translateQuestionPrompt,
      ]);
      action = {
        type: elem.type,
        i: Number(elem.i),
        content: actionContent,
        question: actionQuestionTranslation,
        html: simplifiedElementHtml,
      };
    }
    actionCache.set(identifier, action);
    return action;
  });

  const actions = await Promise.all(actionsPromises);

  saveCacheToFile(actionCache, cacheFileName);
  return actions;
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
    identifierComponents.push(element.textContent.trim().slice(0, 20));
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
