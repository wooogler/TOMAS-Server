import { Page } from "puppeteer";
import { JSDOM } from "jsdom";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

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

export async function findNewElementHtml(
  page: Page | null,
  action: () => Promise<void>
): Promise<string> {
  if (page) {
    // Get initial hidden elements
    const initialHiddenElementIs = await getHiddenElementIs(page);

    // Perform action
    await action();
    await new Promise((r) => setTimeout(r, 1000));

    // Get hidden elements and elements without 'i' attribute after action
    const finalHiddenElementIs = await getHiddenElementIs(page);
    const elementsWithoutI = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const elementsWithoutI: string[] = [];

      elements.forEach((el) => {
        if (!el.hasAttribute("i")) {
          elementsWithoutI.push(el.outerHTML);
        }
      });

      return elementsWithoutI;
    });

    // Find the elements that were hidden and are now shown
    const shownElementsIs = initialHiddenElementIs.filter(
      (i) => !finalHiddenElementIs.includes(i)
    );
    const shownElements = await page.evaluate((shownElementsIs) => {
      return shownElementsIs.map(
        (i) => document.querySelector(`[i="${i}"]`)?.outerHTML || ""
      );
    }, shownElementsIs);

    // Combine newly added and shown elements
    const newAndShownElements = [...elementsWithoutI, ...shownElements];

    if (newAndShownElements.length > 0) {
      // Find the longest HTML string
      const longestHTML = newAndShownElements.reduce((a, b) =>
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
