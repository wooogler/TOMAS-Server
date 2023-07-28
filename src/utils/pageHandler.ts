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

      // Add 'i' attribute to the body element
      document.body.setAttribute("i", String(idCounter));
      idCounter++;

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

export async function getHighestZIndexElementI(
  page: Page,
  hiddenElementIs: string[]
): Promise<string | null> {
  const highestZIndexElementI = await page.evaluate((hiddenElementIs) => {
    const elements = Array.from(document.querySelectorAll("*"));
    let highestZIndexElementI = "0";
    let highestZIndexValue = 0;
    let highestArea = 0;

    elements.forEach((element) => {
      const elementI = element.getAttribute("i");

      if (elementI && hiddenElementIs.includes(elementI)) {
        return; // Skip the current iteration if the element is in the hiddenElementIs list
      }

      // Check if the element is a child of an element in the hiddenElementIs list
      let parent = element.parentElement;
      while (parent) {
        const parentI = parent.getAttribute("i");
        if (parentI && hiddenElementIs.includes(parentI)) {
          return; // Skip the current iteration if the parent element is in the hiddenElementIs list
        }
        parent = parent.parentElement;
      }

      const style = window.getComputedStyle(element);
      const zIndex = parseInt(style.zIndex, 10);

      if (!isNaN(zIndex) && elementI) {
        const htmlElement = element as HTMLElement;
        const area = htmlElement.offsetWidth * htmlElement.offsetHeight;
        if (
          zIndex > highestZIndexValue ||
          (zIndex === highestZIndexValue && area > highestArea)
        ) {
          highestZIndexValue = zIndex;
          highestZIndexElementI = elementI;
          highestArea = area;
        }
      }
    });

    return highestZIndexElementI;
  }, hiddenElementIs);

  return highestZIndexElementI;
}

export async function getUpdatedHtml(
  page: Page | null,
  action: () => Promise<void>
) {
  if (page) {
    const getElementHtmlWithoutTemp = async (elementI: string | null) => {
      if (!elementI) return "";
      return await page.evaluate((i) => {
        const element = document.querySelector(`[i="${i}"]`);
        if (!element) return "";

        const elementClone = element.cloneNode(true) as HTMLElement;
        const elementsWithTemp = Array.from(
          elementClone.querySelectorAll("[temp]")
        );
        elementsWithTemp.forEach((el) => {
          el.removeAttribute("temp");
        });

        return elementClone.outerHTML;
      }, elementI);
    };
    // Get initial highest z-index element's i attribute
    const initialHiddenElementIs = await getHiddenElementIs(page);
    const initialHighestZIndexElementI = await getHighestZIndexElementI(
      page,
      initialHiddenElementIs
    );

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

    // Get highest z-index element's i attribute after action
    const finalHiddenElementIs = await getHiddenElementIs(page);
    console.log("finalHiddenElementIs: ", finalHiddenElementIs);
    const finalHighestZIndexElementI = await getHighestZIndexElementI(
      page,
      finalHiddenElementIs
    );

    const newVisibleElementIs = initialHiddenElementIs.filter(
      (i) => !finalHiddenElementIs.includes(i)
    );

    // If the highest z-index element changed or new elements became visible, return the HTML of the new elements
    if (
      initialHighestZIndexElementI !== finalHighestZIndexElementI ||
      newVisibleElementIs.length > 0
    ) {
      console.log("newVisibleElementIs: ", newVisibleElementIs);
      console.log(
        "initialHighestZIndexElementI: ",
        initialHighestZIndexElementI
      );
      console.log("finalHighestZIndexElementI: ", finalHighestZIndexElementI);
      const elementHtmls = await Promise.all(
        [finalHighestZIndexElementI, ...newVisibleElementIs].map(
          getElementHtmlWithoutTemp
        )
      );

      // Select the longest HTML from the array
      const longestHtml = elementHtmls.reduce((a, b) =>
        a.length > b.length ? a : b
      );
      return longestHtml;
    } else {
      // If the highest z-index element did not change, return the updated HTML of the highest z-index element
      return await getElementHtmlWithoutTemp(initialHighestZIndexElementI);
    }
  } else {
    throw NO_PAGE_ERROR;
  }
}
