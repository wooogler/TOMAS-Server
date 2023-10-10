import { JSDOM } from "jsdom";
import { Prompt } from "./langchainHandler";

interface ActionableElement {
  element: Element;
  type: string;
}

interface Action {
  type: string;
  content: string;
  question: string;
  i: number;
  options?: string[];
}

export function parsingAgent(
  html: string,
  screenDescription: string
): Action[] {
  const dom = new JSDOM(html);
  let screen = dom.window.document.body as Element;
  const actionableElements: ActionableElement[] = [];

  const selectableElements = findSelectableElements(screen);
  selectableElements.forEach((element) => {
    actionableElements.push({ element, type: "select" });
  });
  screen = removeElementsFromScreen(screen, selectableElements);

  const clickableElements = findClickableElements(screen);
  clickableElements.forEach((element) => {
    actionableElements.push({ element, type: "click" });
  });
  screen = removeElementsFromScreen(screen, clickableElements);

  const inputableElements = findInputableElements(screen);
  inputableElements.forEach((element) => {
    actionableElements.push({ element, type: "input" });
  });

  const actions = actionableElements;
}

function elementsToActions(element: Element, type: string): Action {}

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
        if (frequency >= 3) {
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
    return !arr.some((otherElement) => {
      return (
        element !== otherElement &&
        element.contains(otherElement) &&
        element.textContent === otherElement.textContent
      );
    });
  });

  return selectableElements;
}

// Create a map of the frequency of each attribute
function createFrequencyMap(element: Element): Map<string, number> {
  const frequencyMap: Map<string, number> = new Map();

  for (const childElement of element.children) {
    // Add the element's classes to the frequency map
    for (const className of childElement.classList) {
      if (!className.includes("mask")) {
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
      return !nonInputableTypes.includes(inputType || "");
    }
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

function removeI(element: Element): string {
  const elementsWithIAttribute = [element, ...element.querySelectorAll("[i]")];
  elementsWithIAttribute.forEach((el) => el.removeAttribute("i"));

  return element.outerHTML;
}

async function getAction(
  element: Element,
  type: string,
  screen: Element
): Action {
  const i = element.getAttribute("i");
  if (componentDescription) {
  }

  return {
    type,
    i: parseInt(i || "0"),
  };
}

export default parsingAgent;
