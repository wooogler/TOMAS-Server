import { JSDOM } from "jsdom";
import { Prompt, getGpt4Response } from "../utils/langchainHandler";
import { extractSurroundingHtml, simplifyHtml } from "../utils/htmlHandler";
import {
  ActionCache,
  loadCacheFromFile,
  saveCacheToFile,
} from "../utils/fileUtil";
import {
  selectActionTemplate,
  singleActionTemplate,
  tableActionTemplate,
} from "../prompts/screenPrompts";
import {
  makeClickQuestionPrompt,
  makeElementDescriptionPrompt,
  makeGroupDescriptionPrompt,
  makeInputQuestionPrompt,
  makeModifyQuestionPrompt,
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
  const itemElements = Array.from(listElement.children).filter((item) => {
    return !item.classList.contains("theater-tit");
  });

  const itemActions: Action[] = await itemElements.reduce(
    async (prevPromise, itemElement, index) => {
      const prevActions = await prevPromise;
      const clickableElements = findClickableElements(itemElement);
      const selectableElements = findSelectableElements(itemElement);
      itemElement = removeElementsFromScreen(itemElement, selectableElements);

      const timeWrapElements = Array.from(
        itemElement.querySelectorAll(".time-wrap")
      );
      itemElement = removeElementsFromScreen(itemElement, timeWrapElements);

      const itemText = itemElement.textContent?.replace(/\s+/g, " ").trim();
      const itemI = itemElement.getAttribute("i");
      if (clickableElements.length > 0) {
        prevActions.push({
          type: "focus",
          content: itemText || "",
          question: `Do you want to select ${itemText}?`,
          i: Number(itemI),
          html: simplifyHtml(itemElement.outerHTML, true, true),
        });
      }
      return prevActions;
    },
    Promise.resolve([] as Action[])
  );

  return itemActions;
}

export async function parsingItemAgent({
  elementHtml,
  listDescription,
}: {
  elementHtml: string;
  listDescription: string;
}) {
  const dom = new JSDOM(elementHtml);
  let element = dom.window.document.body as Element;
  const originalElement = element.cloneNode(true) as Element;
  const actionableElements: ActionableElement[] = [];

  const selectableElements = findSelectableElements(element);
  selectableElements.forEach((element) => {
    actionableElements.push({
      i: element.getAttribute("i") || "",
      type: "select",
      element,
    });
  });

  element = removeElementsFromScreen(element, selectableElements);

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
    originalElement,
    listDescription
  );

  return actions.sort((a, b) => a.i - b.i);
}

export async function parsingAgent({
  screenHtml,
  screenDescription,
  pageHtml,
  excludeSelectable,
}: {
  screenHtml: string;
  screenDescription: string;
  pageHtml: string;
  excludeSelectable?: boolean;
}): Promise<Action[]> {
  const dom = new JSDOM(screenHtml);
  let screen = dom.window.document.body as Element;
  const pageDom = new JSDOM(pageHtml);
  const page = pageDom.window.document.body as Element;
  let originalScreen = screen.cloneNode(true) as Element;
  const actionableElements: ActionableElement[] = [];

  if (!excludeSelectable) {
    const modifiableElements = findModifiableElements(screen);
    modifiableElements.forEach((element) => {
      actionableElements.push({
        i: element.getAttribute("i") || "",
        type: "modify",
        element: page.querySelector(
          `[i="${element.getAttribute("i")}"]`
        ) as Element,
      });
    });
    screen = removeElementsFromScreen(screen, modifiableElements);
    const selectableElements = findSelectableElements(screen);
    selectableElements.forEach((element) => {
      actionableElements.push({
        i: element.getAttribute("i") || "",
        type: "select",
        element: page.querySelector(
          `[i="${element.getAttribute("i")}"]`
        ) as Element,
      });
    });
    screen = removeElementsFromScreen(screen, selectableElements);
  }

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

  const actions =
    actionableElements.length < 50
      ? await getActions(actionableElements, originalScreen, screenDescription)
      : await getSimpleActions(actionableElements);

  return actions.sort((a, b) => a.i - b.i);
}

function findModifiableElements(screen: Element): Element[] {
  const modifiableElements: Element[] = [];
  const people = screen.querySelector("#ticketKindList");
  const seat = screen.querySelector("#seatLayout");
  if (seat) {
    modifiableElements.push(seat);
  }

  if (people) {
    modifiableElements.push(people);
  }
  return modifiableElements;
}

function findSelectableElements(screen: Element): Element[] {
  const elements: Element[] = [];
  const selectableTagNames = ["ul", "ol", "select", "fieldset", "table"];
  const excludeClassKeywords = [
    "mask",
    "section",
    "swiper",
    "bot",
    "v2",
    "swipe",
    "display",
  ];
  const excludeClasses = ["reserve-link-area2"];

  // Traverse the DOM and find all selectable elements
  function traverseAndFind(element: Element) {
    const tagName = element.tagName.toLowerCase();
    const id = element.getAttribute("id");
    const classList = Array.from(element.classList);

    if (tagName === "div") {
      const frequencyMap = createFrequencyMap(element, excludeClassKeywords);

      for (const frequency of frequencyMap.values()) {
        if (frequency >= 2) {
          elements.push(element);
          break;
        }
      }
    } else if (
      selectableTagNames.includes(tagName) ||
      classList.includes("time-wrap")
    ) {
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

  const selectableElements = repeatedElements
    .filter((element, _, arr) => {
      let countClickable = 0;
      const childElements = Array.from(element.children);
      for (const childElement of childElements) {
        findClickableElements(childElement).forEach(() => countClickable++);
      }
      return countClickable > arr.length / 2;
    })
    .filter((element) => {
      const classList = Array.from(element.classList);
      return !excludeClasses.some((excludeClass) =>
        classList.includes(excludeClass)
      );
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
    if (
      element.hasAttribute("disabled") ||
      element.classList.contains("disabled") ||
      element.classList.contains("impossible")
    ) {
      return false;
    }

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

  // clickableElements의 모든 요소를 결과 리스트에 추가
  const combinedClickableElements = [...clickableElements];

  for (const div of clickableDivs) {
    let isUnique = true;

    for (const elem of clickableElements) {
      if (elem.contains(div) || div.contains(elem)) {
        // clickableElements의 어떤 요소와 겹치는 경우, div를 추가하지 않음
        isUnique = false;
        break;
      }
    }

    // 겹치지 않는 clickableDivs의 요소만 결과 리스트에 추가
    if (isUnique) {
      combinedClickableElements.push(div);
    }
  }

  return combinedClickableElements;
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

  const actions = (await Promise.all(actionsPromises)).filter(
    (action) => action !== null
  ) as Action[];
  actionCache.save();
  return actions;
}

async function getSimpleActions(
  actionableElements: ActionableElement[]
): Promise<Action[]> {
  const actions = await actionableElements.map((elem) => {
    return {
      type: elem.type,
      content:
        elem.type === "click"
          ? `Click ${elem.element.textContent}`
          : `Input ${(elem.element as HTMLInputElement).placeholder}`,
      i: Number(elem.i),
      html: simplifyHtml(elem.element.outerHTML, true),
    };
  });

  return actions;
}

async function processElement(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string,
  actionCache: ActionCache
): Promise<Action | null> {
  const identifier = generateIdentifier(elem.element?.outerHTML || "");
  let action = actionCache.get(identifier);
  if (!action) {
    action = await createAction(elem, screenElement, screenDescription);
    actionCache.set(identifier, action);
  } else {
    action.i = Number(elem.i);
  }
  return action.content === "" ? null : action;
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
  const { content, question, description, options } = await getSelectAction(
    elem,
    screenElement,
    screenDescription
  );

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
  const { content, question, description } = await getSingleAction(
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
    // html: elem.element.outerHTML,
    html: simplifyHtml(elem.element.outerHTML, true),
  };
}

function extractOptions(element: Element): string[] {
  const optionElements = Array.from(element.children);
  return optionElements.map((option) => {
    const scriptTags = option.getElementsByTagName("script");
    while (scriptTags.length > 0) {
      const scriptTag = scriptTags[0];
      scriptTag.parentNode?.removeChild(scriptTag);
    }
    return option.textContent?.replace(/\s+/g, " ").trim() || "";
  });
}

export function modifySelectAction(elem: Element, screenElement: Element) {
  try {
    const elemI = elem.getAttribute("i");
    const element = screenElement.querySelector(`[i="${elemI}"]`) as Element;
    const elementClone = element.cloneNode(true) as Element;

    while (elementClone.children.length > 3) {
      const lastChild = elementClone.lastChild;
      if (lastChild) {
        elementClone.removeChild(lastChild);
      }
    }
    const parentElement = element.parentElement;

    const originalElementInParent = parentElement?.querySelector(
      `[i="${elemI}"]`
    );
    parentElement?.replaceChild(
      elementClone,
      originalElementInParent as Element
    );

    return parentElement;
  } catch (e) {
    console.log(e);
  }
}

async function getSelectAction(
  elem: ActionableElement,
  screenElement: Element,
  screenDescription: string
) {
  let element = elem.element;
  let screen = screenElement;
  const timeWrapElements = Array.from(element.querySelectorAll(".time-wrap"));
  const timeWrapScreenElements = Array.from(
    screen.querySelectorAll(".time-wrap")
  );
  const theaterTitleElements = Array.from(
    element.querySelectorAll(".theater-tit")
  );
  const theaterTitleScreenElements = Array.from(
    screen.querySelectorAll(".theater-tit")
  );
  screen = removeElementsFromScreen(screen, [
    ...timeWrapScreenElements,
    ...theaterTitleScreenElements,
  ]);
  element = removeElementsFromScreen(element, [
    ...timeWrapElements,
    ...theaterTitleElements,
  ]);

  const options = extractOptions(element);

  // const parentElement = modifySelectAction(elem.element, screenElement);
  // const firstThreeItemsWithParentHtml = parentElement?.outerHTML || "";
  // const selectActionPrompt = selectActionTemplate({
  //   options,
  //   firstThreeItemsWithParentHtml: simplifyHtml(
  //     firstThreeItemsWithParentHtml,
  //     true,
  //     true
  //   ),
  //   screenDescription,
  // });
  const selectActionPrompt = selectActionTemplate({
    simplifiedElementHtml: simplifyHtml(element.outerHTML, true),
    simplifiedScreenHtml: simplifyHtml(screen.outerHTML, true),
    screenDescription,
  });
  console.log(selectActionPrompt.content);
  const content = await getGpt4Response([selectActionPrompt]);
  console.log(content);

  const question = await getGpt4Response([
    selectActionPrompt,
    {
      role: "AI",
      content: content,
    },
    makeSelectQuestionPrompt(),
  ]);
  const description = await getGpt4Response([
    selectActionPrompt,
    {
      role: "AI",
      content: content,
    },
    makeGroupDescriptionPrompt(),
  ]);
  return { content, question, description, options };
}

async function getSingleAction(
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
  // console.log(actionPrompt.content);
  const content =
    elem.type === "modify"
      ? await getGpt4Response([actionPrompt])
      : await getGpt4Response([actionPrompt]);
  // console.log(content);
  const makeQuestionPrompt =
    elem.type === "modify"
      ? makeModifyQuestionPrompt
      : elem.type === "input"
      ? makeInputQuestionPrompt
      : makeClickQuestionPrompt;

  const question = await getGpt4Response([
    singleActionPrompt,
    {
      role: "AI",
      content: content,
    },
    makeQuestionPrompt(),
  ]);
  const description = await getGpt4Response([
    singleActionPrompt,
    {
      role: "AI",
      content: content,
    },
    makeElementDescriptionPrompt(),
  ]);

  return { content, question, description };
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
