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

async function getAllElementIs(page: Page | null) {
  if (page) {
    const allElementIds = await page.evaluate(() => {
      const ids: string[] = [];
      const elements = document.querySelectorAll("*");
      elements.forEach((el) => {
        const id = el.getAttribute("i");
        if (id) ids.push(id);
      });

      return ids;
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
  page: Page | null
) {
  const preActionAllElementIs = await getAllElementIs(page);
  const preActionHiddenElementIs = await getHiddenElementIs(page);

  const postActionAllElementIs = await getAllElementIs(page);
  const postActionHiddenElementIs = await getHiddenElementIs(page);

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
