import { JSDOM } from "jsdom";
import {
  getComponentInfo,
  getItemDescription,
  getSelectInfo,
} from "./langchainHandler";

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

    const attributesToKeepForAllComps = ["href"];
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

export function findRepeatingComponents(html: string) {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  const result: Element[] = [];

  function createFrequencyMap(element: Element): Map<string, number> {
    const frequencyMap: Map<string, number> = new Map();

    const attributesToConsider = ["class"];

    element.childNodes.forEach((child) => {
      if (child.nodeType === 1) {
        const childElement = child as Element;

        Array.from(childElement.classList).forEach((className) => {
          if (!className.includes("mask")) {
            frequencyMap.set(className, (frequencyMap.get(className) || 0) + 1);
          }
        });

        Array.from(childElement.attributes).forEach((attr) => {
          if (
            attributesToConsider.includes(attr.name) ||
            attr.name.startsWith("data-")
          ) {
            const attrKey = `${attr.name}=${attr.value}`;
            frequencyMap.set(attrKey, (frequencyMap.get(attrKey) || 0) + 1);
          }
        });
      }
    });
    return frequencyMap;
  }

  const tagsToExcludeFromResults = ["main", "footer", "header"];

  function traverseAndFind(element: Element): void {
    if (element.tagName.toLowerCase() !== "body") {
      const tagName = element.tagName.toLowerCase();

      if (!tagsToExcludeFromResults.includes(tagName)) {
        const frequencyMap = createFrequencyMap(element);

        for (const frequency of frequencyMap.values()) {
          if (frequency >= 3) {
            result.push(element);
            break;
          }
        }
      }
    }

    for (const child of Array.from(element.children)) {
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

function createActionType(interactiveElement: Element): string {
  switch (interactiveElement.tagName.toLowerCase()) {
    case "input":
      const type = interactiveElement.getAttribute("type");
      if (!type || type === "text") return "inputText";
      if (["checkbox", "radio", "button"].includes(type)) return "click";
      break;
    case "button":
    case "a":
      return "click";
    case "select":
    case "table":
    case "fieldset":
      return "focus";
    case "textarea":
      return "inputText";
    case "ul":
    case "ol":
      const listItems = interactiveElement.querySelectorAll("li");
      for (let li of listItems) {
        const clickElements = li.querySelectorAll(
          'input[type="checkbox"], input[type="radio"], input[type="button"], button, a'
        );
        if (clickElements.length >= 2) {
          return "select";
        }
      }
      return "focus";
  }
  return "select";
}

export interface PossibleInteractions {
  actionType: string;
  i: string;
}

export function parsingPossibleInteractions(
  html: string
): PossibleInteractions[] {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  const iAttrSet = new Set<string>();

  // Gather I attributes from specified elements
  let specifiedElements = Array.from(
    body.querySelectorAll("ul, ol, table, fieldset")
  );
  const repeatingComponents = findRepeatingComponents(html);
  repeatingComponents.forEach((element) => {
    const iAttr = element.getAttribute("i");
    if (iAttr && !iAttrSet.has(iAttr)) {
      specifiedElements.push(element);
      iAttrSet.add(iAttr);
    }
  });

  specifiedElements.forEach((element) => {
    Array.from(element.querySelectorAll("[i]")).forEach((el) =>
      iAttrSet.add(el.getAttribute("i")!)
    );
  });

  // Filter interactive elements
  let interactiveElements = Array.from(
    body.querySelectorAll("input, button, a, select, textarea")
  ).filter(
    (element) =>
      !(element.getAttribute("i") && iAttrSet.has(element.getAttribute("i")!))
  );
  interactiveElements.push(...specifiedElements);

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
      });
    }
  });

  return possibleInteractions;
}

function comparePossibleInteractions(
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

export interface ParsingResult {
  i: string;
  action: string;
  description: string;
  html: string;
}

export async function parsingItemAgent({
  html,
  screenDescription,
}: {
  html: string;
  screenDescription: string;
}) {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  const components = Array.from(body.children);
  let firstDescription: string; // 맨 처음 나온 description을 추적하는 변수를 추가합니다.

  const itemComponentsPromises = components.map(async (comp, index) => {
    const iAttr = comp.getAttribute("i");
    const itemDescription = await getItemDescription({
      itemHtml: simplifyHtml(comp.outerHTML, true),
      screenDescription,
      prevDescription: index === 0 ? firstDescription : undefined, // 첫 번째 요소에서만 prevDescription을 사용합니다.
    });
    if (index === 0) {
      firstDescription = itemDescription || ""; // 첫 번째 description을 저장합니다.
    }
    return {
      i: iAttr || "",
      action: "item",
      description: itemDescription,
      html: comp.outerHTML,
    };
  });

  const itemComponents = await Promise.all(itemComponentsPromises);
  // console.log(
  //   itemComponents
  //     .map((comp) => `- ${comp.description} (i=${comp.i})`)
  //     .join("\n")
  // );
  return itemComponents;
}

export async function parsingAgent({
  html,
  screenDescription,
}: {
  html: string;
  screenDescription: string;
}) {
  const possibleInteractions = parsingPossibleInteractions(html).sort(
    comparePossibleInteractions
  );

  const dom = new JSDOM(html);
  const body = dom.window.document.body;

  const actionComponentsPromises = possibleInteractions.map(
    async (interaction) => {
      const iAttr = interaction.i;
      const actionType = interaction.actionType;
      const componentHtml =
        body.querySelector(`[i="${iAttr}"]`)?.outerHTML || "";
      const componentInfo =
        actionType === "select"
          ? await getSelectInfo({
              componentHtml: simplifyHtml(componentHtml, true) || "",
              screenDescription,
              actionType: interaction.actionType,
            })
          : await getComponentInfo({
              componentHtml: simplifyHtml(componentHtml, true) || "",
              screenDescription,
              actionType: interaction.actionType,
            });

      return {
        i: iAttr,
        action: interaction.actionType,
        description: componentInfo?.description,
        html: componentHtml,
      };
    }
  );

  const actionComponents = await Promise.all(actionComponentsPromises);
  // console.log(
  //   actionComponents
  //     .map((comp) => `- ${comp.description} (i=${comp.i})`)
  //     .join("\n")
  // );
  return actionComponents;
}
