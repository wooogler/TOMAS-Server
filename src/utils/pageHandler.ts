import { Page } from "puppeteer";
import { JSDOM } from "jsdom";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

export async function getHiddenElementIs(page: Page | null) {
  if (page) {
    const hiddenElementIs = await page.evaluate(() => {
      const hiddenElementIs: string[] = [];
      const elements = document.body.querySelectorAll("*");
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

export async function addIAttribute(page: Page): Promise<void> {
  if (page) {
    await page.evaluate(() => {
      let idCounter = 0;
      const elements = Array.from(document.body.querySelectorAll("*"));

      // Check existing 'i' attribute values and set the start value
      elements.forEach((el: Element) => {
        if (el.hasAttribute("i")) {
          const currentIValue = Number(el.getAttribute("i"));
          if (currentIValue >= idCounter) {
            idCounter = currentIValue + 1;
          }
        }
      });

      // Make sure that new 'i' values do not overlap with existing ones
      idCounter += 100;

      // Add 'i' attribute to elements that do not have it yet
      elements.forEach((el: Element) => {
        if (!el.hasAttribute("i")) {
          el.setAttribute("i", String(idCounter));
          idCounter++;
        }
      });
    });
  } else {
    throw NO_PAGE_ERROR;
  }
}

export async function findHighestZIndex(page: Page): Promise<number> {
  // Get the identifiers of all hidden elements
  const hiddenElementIs = await getHiddenElementIs(page);

  const highestZIndex = await page.evaluate((hiddenElementIs) => {
    const elements = Array.from(document.body.querySelectorAll("*")).filter(
      (element) => {
        // Exclude elements that are hidden
        const elementId = element.getAttribute("i");
        return elementId ? !hiddenElementIs.includes(elementId) : true;
      }
    );

    let highest = 0;

    elements.forEach((element) => {
      const style = window.getComputedStyle(element);
      const zIndex = parseInt(style.zIndex, 10);

      if (!isNaN(zIndex) && zIndex > highest) {
        highest = zIndex;
      }
    });

    return highest;
  }, hiddenElementIs);

  return highestZIndex;
}

export async function getUpdatedHtml(
  page: Page | null,
  action: () => Promise<void>
) {
  if (page) {
    // Get initial hidden elements
    const initialHiddenElementIs = await getHiddenElementIs(page);
    const initialHighestZIndex = await findHighestZIndex(page);

    // Perform action
    await action();
    await new Promise((r) => setTimeout(r, 1000));

    // Add temporary attribute 'temp' to new elements
    await page.evaluate(() => {
      const elements = Array.from(document.body.querySelectorAll("*"));
      elements.forEach((el) => {
        if (!el.hasAttribute("i")) {
          el.setAttribute("temp", "");
        }
      });
    });

    // Add 'i' attribute to newly added elements
    await addIAttribute(page);

    // Get hidden elements and elements without 'i' attribute after action
    const finalHiddenElementIs = await getHiddenElementIs(page);
    const finalHighestZIndex = await findHighestZIndex(page);

    // If the highest z-index has changed, return the longest new or shown element
    let result;
    if (
      initialHighestZIndex !== finalHighestZIndex &&
      initialHighestZIndex !== 0
    ) {
      const newElements = await page.evaluate(() => {
        const elements = Array.from(document.body.querySelectorAll("*"));
        const newElements: string[] = [];

        elements.forEach((el) => {
          if (el.hasAttribute("temp")) {
            const tempAttrRegex = new RegExp(`\\s*temp="[^"]*"`, "g");
            newElements.push(el.outerHTML.replace(tempAttrRegex, ""));
          }
        });

        return newElements;
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
      const newAndShownElements = [...newElements, ...shownElements];

      if (newAndShownElements.length > 0) {
        // Find the longest HTML string
        result = newAndShownElements.reduce((a, b) =>
          a.length > b.length ? a : b
        );
      } else {
        result = "";
      }
    } else {
      result = await page.evaluate((hiddenElementIds) => {
        const clonedBody = document.body.cloneNode(true) as HTMLElement;
        hiddenElementIds.forEach((id) => {
          const el = clonedBody.querySelector(`[i="${id}"]`);
          el?.parentNode?.removeChild(el);
        });
        return clonedBody.innerHTML;
      }, finalHiddenElementIs);
    }

    // Remove 'temp' attribute after it's done being used
    await page.evaluate(() => {
      const elements = Array.from(document.body.querySelectorAll("[temp]"));
      elements.forEach((el) => {
        el.removeAttribute("temp");
      });
    });

    return result;
  } else {
    throw NO_PAGE_ERROR;
  }
}
