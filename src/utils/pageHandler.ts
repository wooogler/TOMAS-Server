import { Page } from "puppeteer";
import { JSDOM } from "jsdom";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

async function getElementsFromIs(
  html: string,
  is: string[]
): Promise<Element[]> {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const elements: Element[] = [];

  is.forEach((i) => {
    const element = document.querySelector(`[i="${i}"]`);
    if (element) {
      // Only add the element if it's not a descendant of any previously found elements
      if (!elements.some((foundElement) => foundElement.contains(element))) {
        elements.push(element);
      }
    }
  });

  return elements;
}

export async function getAllElementIs(page: Page | null) {
  if (page) {
    const allElementIds = await page.evaluate(() => {
      const elementIs: string[] = [];
      const elements = document.querySelectorAll("*");
      elements.forEach((el) => {
        const i = el.getAttribute("i");
        if (i) elementIs.push(i);
      });

      return elementIs;
    });

    return allElementIds;
  }
  throw NO_PAGE_ERROR;
}

export async function getHiddenElementIs(page: Page | null) {
  if (page) {
    const hiddenElementIs = await page.evaluate(() => {
      const hiddenElementIs: string[] = [];
      const elements = document.querySelectorAll("*");
      elements.forEach((el) => {
        const style = window.getComputedStyle(el);
        const widthInPixels = parseInt(style.width);
        const heightInPixels = parseInt(style.height);
        if (
          style &&
          (style.display === "none" ||
            style.visibility === "hidden" ||
            widthInPixels <= 1 ||
            heightInPixels <= 1)
        ) {
          const i = el.getAttribute("i");
          if (i) hiddenElementIs.push(i);
        }
      });

      return hiddenElementIs;
    });

    return hiddenElementIs;
  }
  throw NO_PAGE_ERROR;
}

function getMostComplexElement(elements: Element[]): Element | null {
  let mostComplexElement: Element | null = null;
  let maxChildCount = 0;

  elements.forEach((currentElement) => {
    const currentChildCount = currentElement.querySelectorAll("*").length;
    if (currentChildCount > maxChildCount) {
      maxChildCount = currentChildCount;
      mostComplexElement = currentElement;
    }
  });

  return mostComplexElement;
}

export async function detectChangedElements(
  preActionHTML: string,
  postActionHTML: string,
  preActionAllElementIs: string[],
  postActionAllElementIs: string[],
  preActionHiddenElementIs: string[],
  postActionHiddenElementIs: string[]
) {
  const addedElementIs = postActionAllElementIs.filter(
    (id) => !preActionAllElementIs.includes(id)
  );
  const removedElementIs = preActionAllElementIs.filter(
    (id) => !postActionAllElementIs.includes(id)
  );
  const newHiddenElementIs = postActionHiddenElementIs.filter(
    (id) => !preActionHiddenElementIs.includes(id)
  );
  const newVisibleElementIs = preActionHiddenElementIs.filter(
    (id) => !postActionHiddenElementIs.includes(id)
  );

  const addedElements = await getElementsFromIs(postActionHTML, addedElementIs);

  const removedElements = await getElementsFromIs(
    preActionHTML,
    removedElementIs
  );

  const newHiddenElements = await getElementsFromIs(
    preActionHTML,
    newHiddenElementIs
  );

  const newVisibleElements = await getElementsFromIs(
    postActionHTML,
    newVisibleElementIs
  );

  const appearedElements = [...addedElements, ...newVisibleElements];
  const vanishedElements = [...removedElements, ...newHiddenElements];

  const appearedElement = getMostComplexElement(appearedElements);
  const vanishedElement = getMostComplexElement(vanishedElements);

  return {
    appearedElement,
    vanishedElement,
  };
}

export async function getContentHTML(page: Page | null) {
  if (page) {
    let content = await page.content();

    // Parse the page content with JSDOM and remove undesired tags
    let dom = new JSDOM(content);
    const { window } = dom;
    const { document } = window;

    ["script", "iframe", "style"].forEach((selector) => {
      Array.from(document.querySelectorAll(selector)).forEach((el) =>
        el.remove()
      );
    });

    content = dom.serialize();

    return content;
  }
  throw NO_PAGE_ERROR;
}

export async function getHighestZIndexElement(page: Page) {
  return await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("*"));
    let highestZIndex = -Infinity;
    let highestZIndexElement = null;
    let highestZIndexElementI = null;

    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const zIndex = style.getPropertyValue("z-index");

      const zIndexNumber = Number(zIndex);
      if (!Number.isNaN(zIndexNumber)) {
        if (zIndexNumber > highestZIndex) {
          highestZIndex = zIndexNumber;
          highestZIndexElement = element;
          highestZIndexElementI = element.getAttribute("i");
        }
      }
    }

    return {
      highestZIndex,
      highestZIndexElementI,
      highestZIndexElement,
      highestZIndexElementHtml: highestZIndexElement?.outerHTML,
    };
  });
}

export async function addIAttribute(page: Page): Promise<void> {
  if (page) {
    await page.evaluate(() => {
      let idCounter = 0;
      const elements = document.querySelectorAll("*");
      elements.forEach((el: Element) => {
        el.setAttribute("i", String(idCounter));
        idCounter++;
      });
    });
  } else {
    throw NO_PAGE_ERROR;
  }
}

export async function findNewElementHtml(page: Page | null) {
  if (page) {
    const newElements = await page.evaluate(() => {
      const newElements: string[] = [];

      const traverseAndCollectNewElements = (
        node: Node,
        newElements: string[]
      ) => {
        // check if the node is an Element
        if (node.nodeType === Node.ELEMENT_NODE) {
          const elementNode = node as Element;
          if (!elementNode.hasAttribute("i")) {
            newElements.push(elementNode.outerHTML);
          } else {
            // if the node has "i" attribute, we check its children
            for (let i = 0; i < elementNode.children.length; i++) {
              traverseAndCollectNewElements(
                elementNode.children[i],
                newElements
              );
            }
          }
        }
      };

      traverseAndCollectNewElements(document.body, newElements);
      return newElements;
    });

    if (newElements.length > 0) {
      // Find the longest HTML string
      const longestHTML = newElements.reduce((a, b) =>
        a.length > b.length ? a : b
      );
      return longestHTML;
    } else {
      return "";
    }
  } else {
    throw NO_PAGE_ERROR;
  }
}
