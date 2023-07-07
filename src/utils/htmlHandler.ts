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

export const simplifyHtml = (html: string) => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  // const rootElement = document.querySelector("*");
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
    removeAttributes(rootElement, ["i", "href"], ["input", "button", "label"]);
    removeAttributes(
      rootElement,
      [
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
    simplifyNestedStructure(rootElement, ["div", "span"], ["a"]);
  }

  const actionComponents = extractActionComponents(rootElement);
  // function printWithoutElement(obj: any): any {
  //   if (Array.isArray(obj)) {
  //     return obj.map(printWithoutElement);
  //   } else if (obj !== null && typeof obj === "object") {
  //     let newObj: any = {};
  //     for (let key in obj) {
  //       if (key !== "element") {
  //         newObj[key] = printWithoutElement(obj[key]);
  //       }
  //     }
  //     return newObj;
  //   } else {
  //     return obj;
  //   }
  // }
  // console.dir(
  //   printWithoutElement(
  //     flattenTree(buildComponentTree(rootElement, actionComponents))
  //   ),
  //   { depth: null }
  // );
  console.log(actionComponents.map((comp) => comp.html));
  return {
    simpleHtml: rootElement.innerHTML.replace(/\s\s+/g, ""),
    actionComponents,
  };
};

function querySelectorAllReverseBFS(
  root: Element,
  selector: string
): Element[] {
  const queue: { element: Element; level: number }[] = [
    { element: root, level: 0 },
  ];
  const groupedByLevel: Element[][] = [];
  const result: Element[] = [];

  while (queue.length > 0) {
    const { element, level } = queue.shift()!;
    if (!groupedByLevel[level]) {
      groupedByLevel[level] = [];
    }

    groupedByLevel[level].push(element);

    Array.from(element.children).forEach((child) =>
      queue.push({ element: child as Element, level: level + 1 })
    );
  }

  groupedByLevel.reverse().forEach((level) => {
    level.forEach((element) => {
      if (element.matches(selector)) {
        result.push(element);
      }
    });
  });

  return result;
}

type ConditionType =
  | "input_radio"
  | "button"
  | "input_button"
  | "input_text"
  | "link"
  | "list";

interface Condition {
  type: ConditionType;
  test: (element: Element) => boolean;
}

const conditions: Condition[] = [
  {
    type: "input_radio",
    test: (element: Element) => {
      const radioInputs = element.querySelectorAll('input[type="radio"]');
      return radioInputs.length >= 2;
    },
  },
  {
    type: "button",
    test: (element: Element) => {
      return (
        element.tagName.toLowerCase() === "button" &&
        element.getAttribute("type") === "button"
      );
    },
  },
  {
    type: "input_button",
    test: (element: Element) => {
      return (
        element.tagName.toLowerCase() === "div" &&
        element.querySelector('input[type="button"]') !== null &&
        element.querySelector("label") !== null
      );
    },
  },
  {
    type: "link",
    test: (element: Element) => {
      return element.tagName.toLowerCase() === "a";
    },
  },
  {
    type: "list",
    test: (element: Element) => {
      return (
        element.tagName.toLowerCase() === "div" &&
        (element.querySelector("ul") !== null ||
          element.querySelector("ol") !== null)
      );
    },
  },
];

function getCondition(element: Element): ConditionType | null {
  for (const condition of conditions) {
    if (condition.test(element)) {
      return condition.type;
    }
  }
  return null;
}

interface ActionComponent {
  html: string;
  type: ConditionType;
  i: string;
}

function extractActionComponents(root: Element): ActionComponent[] {
  let components: ActionComponent[] = [];
  let candidateElements: Element[] = querySelectorAllReverseBFS(
    root,
    "div, button"
  );
  let addedIValues = new Set<string | null>();

  for (let i = 0; i < candidateElements.length; i++) {
    const conditionType = getCondition(candidateElements[i]);
    if (conditionType) {
      const currentIValue = candidateElements[i].getAttribute("i");

      if (addedIValues.has(currentIValue)) continue;
      let descendants = candidateElements[i].querySelectorAll("*");
      let skip = false;
      descendants.forEach((descendant) => {
        if (addedIValues.has(descendant.getAttribute("i"))) {
          skip = true;
        }
      });
      if (skip) continue;

      if (currentIValue) {
        components.push({
          html: candidateElements[i].outerHTML,
          type: conditionType,
          i: currentIValue,
        });
        addedIValues.add(currentIValue);
      }
    }
  }

  return components;
}

interface ComponentNode {
  element?: Element;
  components: (ActionComponent | ComponentNode)[];
  id: string | null;
}

function buildComponentTree(
  root: Element,
  actionComponents: ActionComponent[]
): ComponentNode {
  const node: ComponentNode = {
    element: root,
    components: [],
    id: root.getAttribute("id"),
  };

  const childNodes = Array.from(root.children);
  for (const childNode of childNodes) {
    const actionComponent = actionComponents.find(
      (component) => component.i === childNode.getAttribute("i")
    );
    if (actionComponent) {
      node.components.push(actionComponent);
    } else {
      node.components.push(buildComponentTree(childNode, actionComponents));
    }
  }

  return node;
}

function flattenTree(tree: ComponentNode): ComponentNode {
  if (tree.components.length === 1 && "components" in tree.components[0]) {
    return flattenTree(tree.components[0] as ComponentNode);
  }

  let flattenedComponents = [];
  for (const component of tree.components) {
    if ("components" in component) {
      const flattened = flattenTree(component as ComponentNode);
      if (flattened.components.length > 0) {
        flattenedComponents.push(flattened);
      }
    } else {
      flattenedComponents.push(component);
    }
  }

  return {
    ...tree,
    components: flattenedComponents,
  };
}
