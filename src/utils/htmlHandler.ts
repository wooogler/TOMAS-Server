import { JSDOM } from "jsdom";
import {
  getComplexItemDescription,
  getComponentInfo,
  getSelectInfo,
  getSimpleItemDescription,
} from "./langchainHandler";
import { ActionComponent } from "./pageHandler";

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

function createActionType(interactiveElement: Element): ActionType {
  switch (interactiveElement.tagName.toLowerCase()) {
    case "input":
      const type = interactiveElement.getAttribute("type");
      if (!type || type === "text") return "input";
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

export async function parsingItemAgent({
  screenHtml,
  screenDescription,
}: {
  screenHtml: string;
  screenDescription: string;
}): Promise<ActionComponent[]> {
  const dom = new JSDOM(screenHtml);
  const body = dom.window.document.body;
  const components = Array.from(body.children);
  let firstDescription: string;

  const itemComponentsPromises = components.map<
    Promise<ActionComponent | null>
  >(async (comp, index) => {
    const iAttr = comp.getAttribute("i");
    const possibleInteractions = parsingPossibleInteractions(comp.outerHTML);
    let itemDescription: string | undefined;

    switch (possibleInteractions.length) {
      case 0:
        return null;
      case 1:
        itemDescription = await getSimpleItemDescription({
          itemHtml: simplifyHtml(comp.outerHTML, true),
          screenHtml: simplifyHtml(screenHtml, true),
          screenDescription,
        });
        if (index === 0) {
          firstDescription = itemDescription || "";
        }
        if (possibleInteractions[0].actionType === "click") {
          return {
            i: possibleInteractions[0].i,
            actionType: "click",
            description: "Click " + itemDescription,
            html: comp.outerHTML,
          };
        } else {
          return {
            i: possibleInteractions[0].i,
            actionType: "select",
            description: "Select " + itemDescription,
            html: comp.outerHTML,
          };
        }

      default:
        itemDescription = await getComplexItemDescription({
          itemHtml: simplifyHtml(comp.outerHTML, true),
          screenHtml: simplifyHtml(screenHtml, true),
          prevDescription: index === 0 ? firstDescription : undefined,
          screenDescription,
        });
        if (index === 0) {
          firstDescription = itemDescription || "";
        }
        return {
          i: iAttr || "",
          actionType: "select",
          description: "Select " + itemDescription,
          html: comp.outerHTML,
        };
    }
  });

  const itemComponents = await Promise.all(itemComponentsPromises);
  return itemComponents.filter((item) => item !== null) as ActionComponent[];
}

export async function parsingAgent({
  screenHtml,
  screenDescription,
}: {
  screenHtml: string;
  screenDescription: string;
}): Promise<ActionComponent[]> {
  const possibleInteractions = parsingPossibleInteractions(screenHtml).sort(
    comparePossibleInteractions
  );

  const dom = new JSDOM(screenHtml);
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
              screenHtml: simplifyHtml(screenHtml, true),
              actionType: interaction.actionType,
              screenDescription,
            })
          : await getComponentInfo({
              componentHtml: simplifyHtml(componentHtml, true) || "",
              screenHtml: simplifyHtml(screenHtml, true),
              actionType: interaction.actionType,
              screenDescription,
            });

      return {
        i: iAttr,
        actionType: interaction.actionType,
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
