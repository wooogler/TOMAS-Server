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
  | "input_checkbox"
  | "input_range"
  | "link"
  | "table"
  | "paragraph"
  | "list"
  | "Unknown";

interface Condition {
  type: ConditionType;
  test: (element: Element) => boolean;
}

const conditions: Condition[] = [
  {
    type: "button",
    test: (element: Element) => {
      return (
        element.tagName.toLowerCase() === "button" 
        //&& element.getAttribute("type") === "button" // some buttons do not have type attribute
      );
    },
  },
  {
    type: "input_text",
    test: (element: Element) => {
        return (
            element.tagName.toLowerCase() === "input" &&
            element.getAttribute("type") === "text"
        )
    }
  },
  {
    type: "input_radio",
    test: (element: Element) => {
        return (
            element.tagName.toLowerCase() === "input" &&
            element.getAttribute("type") === "radio"
        );
        }
  },
  {
    type: "input_button",
    test: (element: Element) => {
      return (
        element.tagName.toLowerCase() === "input" &&
        element.getAttribute("type") === "button"
      );
    },
  },
  {
    type: "input_checkbox",
    test: (element: Element) => {
        return (
            element.tagName.toLowerCase() === "input" &&
            element.getAttribute("type") === "checkbox"
        );
        }
  },
  {
    type: "input_range",
    test: (element: Element) => {
        return (
            element.tagName.toLowerCase() === "input" &&
            element.getAttribute("type") === "range"
        );
        }
  },
  
  {
    type: "link",
    test: (element: Element) => {
      return element.tagName.toLowerCase() === "a";
    },
  },
  {
    type: "table",
    test: (element: Element) => {
        return element.tagName.toLowerCase() === "table";
        }
  },
  {
    type: "paragraph",
    test: (element: Element) => {
        return element.tagName.toLowerCase() === "p";
        }
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
  {
    type: "Unknown",
    test: (element: Element) => {
        return true;
        }
  }
];

function getCondition(element: Element): ConditionType | null {
  for (const condition of conditions) {
    if (condition.test(element)) {
      return condition.type;
    }
  }
  return null;
}



function get_condition(element: Element): string | null {
    for (const condition of conditions) {
      if (condition.test(element)) {
        return condition.type;
      }
    }
    return null;
  }

  function traverse_element(element: Element, s: Set<string>): void {
    const iAttr = element.getAttribute("i");
    if (iAttr !== null) {
      s.add(iAttr);
    }
    else{
        return;
    }
    for (const child of element.children) {
      traverse_element(child, s);
    }
  }

const threshold = 10;
function traverse_element2(
    element: Element,
    s: Element[],
    action_components: Set<string>
  ): void {
    const iAttr = element.getAttribute("i");
    if (iAttr !== null) {
      const tmp_leave_node_set = new Set<string>();
      traverse_element(element, tmp_leave_node_set);
      const inter_set = new Set([...tmp_leave_node_set].filter((x) => action_components.has(x)));
      if (inter_set.size === 0) {
        return;
      }
      if (inter_set.size <= threshold) {
        s.push(element);
        return;
      }
    }
  
    for (const child of element.children) {
      traverse_element2(child, s, action_components);
    }
  }
  
  

export interface ActionComponent {
  html: string;
  type: string;
  i: string;
}
export function extractActionComponents(html: string): ActionComponent[] {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const root = document.body;
  
    const tmp_root = root.cloneNode(true) as Element;
    const list_elements = Array.from(tmp_root.querySelectorAll("ul, ol"));
    const added_i_values = new Set<string>();
    for (const list_element of list_elements) {
        traverse_element(list_element, added_i_values);
    }

    const table_elements = Array.from(tmp_root.querySelectorAll("table"));
    for (const i of table_elements) {
      traverse_element(i, added_i_values);
    }
  
    // get fieldset elements
    const fieldset_elements = Array.from(tmp_root.querySelectorAll("fieldset"));
    for (const i of fieldset_elements) {
      traverse_element(i, added_i_values);
    }

    // find all paragraph elements with interactive elements
    const paragraph_elements = Array.from(tmp_root.querySelectorAll("p"));
    const paragraph_with_active_elements: Element[] = [];
    for (const i of paragraph_elements) {
      const tmp_rec = i.querySelectorAll("input, button, a, select, textarea");
      if (i.getAttribute("i") && added_i_values.has(i.getAttribute("i")!)) {
          continue;
      }
          
      if (tmp_rec.length > 0) {
          paragraph_with_active_elements.push(i);
          traverse_element(i, added_i_values);
      }
  }

    // get all other action components
    const interactive_elements = Array.from(tmp_root.querySelectorAll("input, button, a, select, textarea"));
    const interactive_elements_i_attr = new Set(
        interactive_elements
          .map((el) => el.getAttribute("i"))
          .filter((x) => x !== null) as string[]
      );
    
    // remove duplicated elements from interactive elements
    const tmp_set = new Set(interactive_elements);
    for (const i of tmp_set) {
    if (i.getAttribute("i") && added_i_values.has(i.getAttribute("i")!)) {
        interactive_elements.splice(interactive_elements.indexOf(i), 1);
    }
    }

 interactive_elements.push(...list_elements, ...table_elements, ...fieldset_elements, ...paragraph_with_active_elements);
  const interactive_elements_i_attr2 = new Set(
      interactive_elements
      .map((el) => el.getAttribute("i"))
      .filter((x) => x !== null) as string[]
  ); 
    // merge components
    // For each element containing less than {threshold} action components, we try to merge them.

    const merged_components: Element[] = [];
    traverse_element2(tmp_root, merged_components, interactive_elements_i_attr2);

    const components: any[] = [];

    for (const element of merged_components) {
        const condition_type = get_condition(element);
        if (condition_type) {
                components.push({
                html: element.outerHTML,
                type: condition_type,
                i: element.getAttribute("i"),
            });
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
