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

const changeAttributeName = (
  element: Element,
  oldName: string,
  newName: string
) => {
  const attribute = element.getAttributeNode(oldName);
  if (attribute) {
    const value = attribute.value;
    element.removeAttribute(oldName);
    element.setAttribute(newName, value);
  }
  const children = Array.from(element.children);
  for (const child of children) {
    changeAttributeName(child, oldName, newName);
  }
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

export const simplifyHtml = (html: string, removeI: boolean = true) => {
  const dom = new JSDOM(html);
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
    removeAttributes(rootElement, removeI ? ["href"] : ["i", "href"], [
      "input",
      "button",
      "label",
    ]);
    removeAttributes(
      rootElement,
      removeI
        ? [
            "href",
            "type",
            "aria-label",
            "role",
            "checked",
            "value",
            "aria-expanded",
            "aria-controls",
          ]
        : [
            "i",
            "href",
            "type",
            "aria-label",
            "role",
            "checked",
            "value",
            "aria-expanded",
            "aria-controls",
          ],
      []
    );
    removeEmptyElements(rootElement, ["input", "button", "label", "a"]);
    simplifyNestedStructure(
      rootElement,
      ["div", "span"],
      ["button", "input", "a", "select", "textarea"]
    );
  }

  return {
    html: rootElement.innerHTML.replace(/\s\s+/g, ""),
    element: rootElement,
  };
};

function gatherIAttrFromElement(element: Element, iAttrSet: Set<string>): void {
  const iAttr = element.getAttribute("i");
  if (iAttr !== null) {
    iAttrSet.add(iAttr);
  } else {
    return;
  }
  for (const child of element.children) {
    gatherIAttrFromElement(child, iAttrSet);
  }
}

const threshold = 10;
function searchComponentsInElement(
  element: Element,
  componentElements: Element[],
  actionComponents: Set<string>
): void {
  const iAttr = element.getAttribute("i");
  if (iAttr !== null) {
    const temporarySet = new Set<string>();
    gatherIAttrFromElement(element, temporarySet);
    const intersectionSet = new Set(
      [...temporarySet].filter((x) => actionComponents.has(x))
    );
    if (intersectionSet.size === 0) {
      return;
    }
    if (intersectionSet.size <= threshold) {
      componentElements.push(element);
      return;
    }
  }

  for (const child of element.children) {
    searchComponentsInElement(child, componentElements, actionComponents);
  }
}

export interface FeatureComponent {
  html: string;
  i: string;
}

function gatherIAttrsFromElements(
  elements: Element[],
  iAttrSet: Set<string>
): void {
  elements.forEach((element) => gatherIAttrFromElement(element, iAttrSet));
}

function filterInteractiveElements(
  elements: Element[],
  iAttrSet: Set<string>
): Element[] {
  return elements.filter(
    (element) =>
      !(element.getAttribute("i") && iAttrSet.has(element.getAttribute("i")!))
  );
}

function extractIAttributes(elements: Element[]): Set<string> {
  return new Set(
    elements
      .map((el) => el.getAttribute("i"))
      .filter((x) => x !== null) as string[]
  );
}

export function extractFeatureComponents(html: string): FeatureComponent[] {
  const dom = new JSDOM(html);
  const tmpRoot = dom.window.document.body.cloneNode(true) as Element;
  const iAttrSet = new Set<string>();

  const listElements = Array.from(tmpRoot.querySelectorAll("ul, ol"));
  gatherIAttrsFromElements(listElements, iAttrSet);

  const tableElements = Array.from(tmpRoot.querySelectorAll("table"));
  gatherIAttrsFromElements(tableElements, iAttrSet);

  const fieldsetElements = Array.from(tmpRoot.querySelectorAll("fieldset"));
  gatherIAttrsFromElements(fieldsetElements, iAttrSet);

  const paragraphElements = Array.from(tmpRoot.querySelectorAll("p")).filter(
    (paragraphElement) => {
      const hasActiveElements =
        paragraphElement.querySelectorAll("input, button, a, select, textarea")
          .length > 0;
      return (
        hasActiveElements && !iAttrSet.has(paragraphElement.getAttribute("i")!)
      );
    }
  );
  gatherIAttrsFromElements(paragraphElements, iAttrSet);

  let interactiveElements = filterInteractiveElements(
    Array.from(tmpRoot.querySelectorAll("input, button, a, select, textarea")),
    iAttrSet
  );

  interactiveElements.push(
    ...listElements,
    ...tableElements,
    ...fieldsetElements,
    ...paragraphElements
  );

  const mergedComponents: Element[] = [];
  searchComponentsInElement(
    tmpRoot,
    mergedComponents,
    extractIAttributes(interactiveElements)
  );

  const components: FeatureComponent[] = [];
  mergedComponents.forEach((mergedComponent) => {
    components.push({
      html: mergedComponent.outerHTML,
      i: mergedComponent.getAttribute("i")!,
    });
  });

  return components;
}

export interface PossibleInteractions {
    actionType: string;
    i: string;
  }
export function parsingPossibleInteraction(html: string): PossibleInteractions[] {
    const dom = new JSDOM(html);
    const tmpRoot = dom.window.document.body.cloneNode(true) as Element;
    const iAttrSet = new Set<string>();
  
    const listElements = Array.from(tmpRoot.querySelectorAll("ul, ol"));
    gatherIAttrsFromElements(listElements, iAttrSet);
  
    const tableElements = Array.from(tmpRoot.querySelectorAll("table"));
    gatherIAttrsFromElements(tableElements, iAttrSet);
  
    const fieldsetElements = Array.from(tmpRoot.querySelectorAll("fieldset"));
    gatherIAttrsFromElements(fieldsetElements, iAttrSet);

    let interactiveElements = filterInteractiveElements(
        Array.from(tmpRoot.querySelectorAll("input, button, a, select, textarea")),
        iAttrSet
      );
    
    interactiveElements.push(
    ...listElements,
    ...tableElements,
    ...fieldsetElements,
    );
    
    const possibleInteractions: PossibleInteractions[] = [];

    interactiveElements.forEach(interactiveElement => {
        let actionType = "";
        switch(interactiveElement.tagName.toLowerCase()) {
            case "input":
                if (interactiveElement.hasAttribute("type") == false) {
                    actionType = "inputText";
                }
                else if (interactiveElement.getAttribute("type") === "text") {
                    actionType = "inputText";
                }
                else if (interactiveElement.getAttribute("type") === "checkbox") {
                    actionType = "click";
                }
                else if (interactiveElement.getAttribute("type") === "radio") {
                    actionType = "click";
                }
                else if (interactiveElement.getAttribute("type") === "button") {
                    actionType = "click";
                }
                break;
            case "button":
                actionType = "click";
                break;
            case "a":
                actionType = "click";
                break;
            case "select":
                actionType = "select";
                break;
            case "textarea":
                actionType = "inputText";
                break;
            case "ul":
                actionType = "select";
                break;
            case "ol":
                actionType = "select";
                break;
            case "table":
                actionType = "select";
                break;
            case "fieldset":
                actionType = "select";
                break;
        }
        possibleInteractions.push({
            actionType: actionType,
            i: interactiveElement.getAttribute("i")!
        })
    }) 
        

    return possibleInteractions;
}
