// Functions to handle html string.
import { JSDOM } from "jsdom";

const removeSpecificTags = (element: Element, tagNames: string[]) => {
  for (const tagName of tagNames) {
    const specificTagElements = Array.from(
      element.getElementsByTagName(tagName)
    );
    for (const specificTag of specificTagElements) {
      specificTag.parentNode?.removeChild(specificTag);
    }
  }
  const children = Array.from(element.children);
  for (const child of children) {
    removeSpecificTags(child, tagNames);
  }
};

export const removeAttributes = (
  element: Element,
  attributesToKeep: string[],
  excludeTags: string[]
) => {
  if (!excludeTags.includes(element.tagName.toLowerCase())) {
    const attributes = Array.from(element.attributes);
    for (const attribute of attributes) {
      if (!attributesToKeep.includes(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const children = Array.from(element.children);
  for (const child of children) {
    removeAttributes(child, attributesToKeep, excludeTags);
  }
};

export const removeAttributeI = (html: string) => {
  const dom = new JSDOM(html);
  const element = dom.window.document.body;
  element.querySelectorAll("*").forEach((node) => {
    if (node.hasAttribute("i")) {
      node.removeAttribute("i");
    }
  });
  return element.innerHTML;
};

const containsSpecificTag = (element: Element, includeTags: string[]) => {
  if (includeTags.includes(element.tagName.toLowerCase())) {
    return true;
  }

  for (const child of Array.from(element.children)) {
    if (containsSpecificTag(child, includeTags)) {
      return true;
    }
  }

  return false;
};

const isEmptyElement = (element: Element, includeTags: string[]) => {
  const hasNonISpecificAttributes = Array.from(element.attributes).some(
    (attr) => attr.name !== "i"
  );

  return (
    !containsSpecificTag(element, includeTags) &&
    !element.textContent?.trim() &&
    !hasNonISpecificAttributes
  );
};

const removeEmptyElements = (element: Element, includeTags: string[]) => {
  const children = Array.from(element.children);
  for (const child of children) {
    if (isEmptyElement(child, includeTags)) {
      element.removeChild(child);
    } else removeEmptyElements(child, includeTags);
  }
};

const simplifyNestedStructure = (
  element: Element,
  targetTags: string[],
  avoidTags: string[]
) => {
  let currentElement = element;
  while (
    targetTags.includes(currentElement.tagName.toLowerCase()) &&
    currentElement.children.length === 1 &&
    !containsSpecificTag(currentElement, avoidTags)
  ) {
    let child = currentElement.children[0];
    if (child.children.length !== 1) {
      break;
    }
    currentElement.removeChild(child);
    currentElement.appendChild(child.children[0]);
  }

  Array.from(currentElement.children).forEach((child) =>
    simplifyNestedStructure(child, targetTags, avoidTags)
  );
};

export const simplifyItemHtml = (html: string) => {
  const dom = new JSDOM(html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""));
  const document = dom.window.document;
  const rootElement = document.body;

  if (rootElement) {
    removeSpecificTags(rootElement, ["path"]);
    const attributesToKeep = [
      "href",
      "type",
      "aria-label",
      "role",
      "checked",
      "aria-expanded",
      "aria-controls",
      "readonly",
      "role",
      "alt",
      "class",
    ];
    removeAttributes(rootElement, attributesToKeep, []);
    removeEmptyElements(rootElement, ["input", "button", "label", "a"]);
    simplifyNestedStructure(
      rootElement,
      ["div", "span"],
      ["button", "input", "a", "select", "textarea"]
    );
  }
  return rootElement.innerHTML.replace(/\s\s+/g, "");
};

export const simplifyHtml = (
  html: string,
  removeI: boolean = true,
  isClass: boolean = false
) => {
  const dom = new JSDOM(html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""));
  const document = dom.window.document;
  const rootElement = document.body;
  if (rootElement) {
    removeSpecificTags(rootElement, [
      "script",
      "style",
      "svg",
      "path",
      "link",
      "meta",
    ]);

    const attributesToKeepForAllComps = ["href", "clickable"];
    if (isClass === true) {
      attributesToKeepForAllComps.push("class");
    }
    removeAttributes(
      rootElement,
      removeI
        ? attributesToKeepForAllComps
        : ["i", ...attributesToKeepForAllComps],
      ["input", "button", "label"]
    );

    const attributesToKeepForActionComps = [
      "href",
      "type",
      "aria-label",
      "role",
      "checked",
      "aria-expanded",
      "aria-controls",
      "readonly",
      "role",
      "alt",
      "clickable",
    ];
    if (isClass === true) {
      attributesToKeepForActionComps.push("class");
    }
    removeAttributes(
      rootElement,
      removeI
        ? attributesToKeepForActionComps
        : ["i", ...attributesToKeepForActionComps],
      []
    );
    removeEmptyElements(rootElement, ["input", "button", "label", "a"]);
    simplifyNestedStructure(
      rootElement,
      ["div", "span"],
      ["button", "input", "a", "select", "textarea"]
    );
  }

  return rootElement.innerHTML.replace(/\s\s+/g, "");
};

const COMPLEX_TAG_LIST = ["img", "a", "button", "input", "select"];
const MIN_COMPLEX_TAG_COUNT = 12;

function isComplex(element: Element): boolean {
  let complexTagCount = 0;

  for (const tag of COMPLEX_TAG_LIST) {
    complexTagCount += element.querySelectorAll(tag).length;
    if (complexTagCount >= MIN_COMPLEX_TAG_COUNT) {
      return true;
    }
  }

  return false;
}

export function findRepeatingComponents(html: string) {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  const result: Element[] = [];

  const attributesToConsider = new Set(["class"]);
  const tagsToExcludeFromResults = new Set(["main", "footer", "header"]);

  function createFrequencyMap(element: Element): Map<string, number> {
    const frequencyMap: Map<string, number> = new Map();

    for (const childElement of element.children) {
      for (const className of childElement.classList) {
        if (!className.includes("mask")) {
          frequencyMap.set(className, (frequencyMap.get(className) || 0) + 1);
        }
      }

      for (const attr of childElement.attributes) {
        if (
          attributesToConsider.has(attr.name) ||
          attr.name.startsWith("data-")
        ) {
          const attrKey = `${attr.name}=${attr.value}`;
          frequencyMap.set(attrKey, (frequencyMap.get(attrKey) || 0) + 1);
        }
      }
    }

    return frequencyMap;
  }

  function traverseAndFind(element: Element): void {
    if (
      element.tagName.toLowerCase() !== "body" &&
      !tagsToExcludeFromResults.has(element.tagName.toLowerCase())
    ) {
      const frequencyMap = createFrequencyMap(element);

      for (const frequency of frequencyMap.values()) {
        if (frequency >= 3 && isComplex(element)) {
          result.push(element);
          break;
        }
      }
    }

    for (const child of element.children) {
      traverseAndFind(child as Element);
    }
  }

  traverseAndFind(body);

  return result.filter((parentElement, _, arr) => {
    return !arr.some(
      (otherElement) =>
        otherElement !== parentElement && otherElement.contains(parentElement)
    );
  });
}

export type ActionType = "select" | "input" | "click" | "focus" | "item";

const inputTypes = [
  "text",
  "password",
  "search",
  "url",
  "tel",
  "email",
  "number",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
];

function createActionType(interactiveElement: Element): ActionType {
  switch (interactiveElement.tagName.toLowerCase()) {
    case "input":
      const type = interactiveElement.getAttribute("type");
      if (!type || inputTypes.includes(type)) return "input";
      if (["checkbox", "radio", "button"].includes(type)) return "click";
      break;
    case "button":
    case "a":
      return "click";
    case "select":
    case "table":
    case "fieldset":
    case "ul":
    case "ol":
      return "select";
    case "textarea":
      return "input";
    case "div":
      if (interactiveElement.getAttribute("clickable") === "true")
        return "click";
      else return "select";
    // case "ul":
    // case "ol":
    //   const listItems = interactiveElement.querySelectorAll("li");
    //   for (let li of listItems) {
    //     const clickElements = li.querySelectorAll(
    //       'input[type="checkbox"], input[type="radio"], input[type="button"], button, a'
    //     );
    //     if (clickElements.length >= 2) {
    //       return "select";
    //     }
    //   }
    //   return "focus";
  }
  return "select";
}

export interface PossibleInteractions {
  actionType: ActionType;
  i: string;
  tagName?: string;
}

const INFO_TAG_LIST = ["img", "a", "button", "input", "select"];

export function countingInfoElements(html: string): number {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  let count = 0;
  for (const tag of INFO_TAG_LIST) {
    count += body.querySelectorAll(tag).length;
  }
  return count;
}

export function parsingPossibleInteractions(
  html: string
): PossibleInteractions[] {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  const iAttrSet = new Set<string>();

  let components: Element[] = [];
  const repeatingComponents = findRepeatingComponents(html);
  repeatingComponents.forEach((element) => {
    Array.from(element.querySelectorAll("[i]")).forEach((el) =>
      iAttrSet.add(el.getAttribute("i")!)
    );
    components.push(element);
  });

  const iAttrForReapeatingComponents = new Set<string>();
  repeatingComponents.forEach((element) => {
    const iAttr = element.getAttribute("i");
    iAttrForReapeatingComponents.add(iAttr!);
  });

  let specifiedElements = Array.from(
    body.querySelectorAll("ul, ol, table, fieldset")
  );
  specifiedElements.forEach((element) => {
    const iAttr = element.getAttribute("i");
    if (
      iAttr &&
      !iAttrSet.has(iAttr) &&
      !iAttrForReapeatingComponents.has(iAttr)
    ) {
      components.push(element);
      Array.from(element.querySelectorAll("[i]")).forEach((el) =>
        iAttrSet.add(el.getAttribute("i")!)
      );
    }
  });

  // Filter interactive elements
  let interactiveElements = Array.from(
    body.querySelectorAll("input, button, a, select, textarea")
  ).filter((element) => {
    let isUniqueElement = !(
      element.getAttribute("i") && iAttrSet.has(element.getAttribute("i")!)
    );
    Array.from(element.querySelectorAll("[i]")).forEach((el) =>
      iAttrSet.add(el.getAttribute("i")!)
    );
    return isUniqueElement;
  });

  let divElements = Array.from(body.querySelectorAll("div")).filter(
    (element) => element.getAttribute("clickable") === "true"
  );

  divElements.forEach((element) => {
    const iAttr = element.getAttribute("i");
    if (iAttr && !iAttrSet.has(iAttr)) {
      components.push(element);
      Array.from(element.querySelectorAll("[i]")).forEach((el) =>
        iAttrSet.add(el.getAttribute("i")!)
      );
    }
  });

  interactiveElements.push(...components);

  const possibleInteractions: PossibleInteractions[] = [];

  // Determine action type and gather possible interactions
  interactiveElements.forEach((interactiveElement) => {
    const actionType = createActionType(interactiveElement);

    if (
      actionType &&
      !(
        interactiveElement.hasAttribute("readonly") &&
        interactiveElement.getAttribute("type") === "text"
      )
    ) {
      possibleInteractions.push({
        actionType: actionType,
        i: interactiveElement.getAttribute("i")!,
        tagName: interactiveElement.tagName.toLowerCase(),
      });
    }
  });

  return possibleInteractions;
}

export function comparePossibleInteractions(
  a: PossibleInteractions,
  b: PossibleInteractions
) {
  if (parseInt(a.i) < parseInt(b.i)) {
    return -1;
  }
  if (parseInt(a.i) > parseInt(b.i)) {
    return 1;
  }
  return 0;
}

export function elementTextLength(html: string) {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  return body.textContent?.length || 0;
}

export interface ComponentInfo {
  context: string;
  action: {
    type: ActionType;
    description: string;
  };
  description: string;
}

const capitalizeFirstCharacter = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

export const editActionType = (actionType: ActionType) => {
  // const action = actionType === "focus" ? "select" : actionType;
  const actionName = capitalizeFirstCharacter(actionType);
  return actionName;
};

export function extractSurroundingHtml(
  htmlString: string,
  target: string,
  range = 1000
) {
  const startIndex = htmlString.indexOf(target);
  if (startIndex === -1) {
    return null;
  }

  const endIndex = startIndex + target.length;

  const beforeTarget = htmlString.substring(
    Math.max(0, startIndex - range),
    startIndex
  );

  const afterTarget = htmlString.substring(endIndex, endIndex + range);

  return "..." + beforeTarget + target + afterTarget + "...";
}

export function removeBeforeAndIncludingKeyword(sentence: string): string {
  const keyword = "It is ";
  const index = sentence.indexOf(keyword);

  if (index !== -1) {
    return sentence.substring(index + keyword.length);
  }
  return sentence; // 만약 "represents"가 문장에 없다면 원래 문장을 반환
}
