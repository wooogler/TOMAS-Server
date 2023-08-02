import puppeteer, { Browser, Page } from "puppeteer";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

export class PageHandler {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({ headless: false });
    const context = await this.browser?.createIncognitoBrowserContext();
    this.page = await context.newPage();
    await this.page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );
    await this.page.setViewport({ width: 390, height: 844 });
  }

  private async getPage() {
    if (!this.page) {
      throw new Error("Page is not initialized. Please call initialize first.");
    }
    return this.page;
  }

  private async getElement(selector: string) {
    const page = await this.getPage();
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element with selector ${selector} not found.`);
    }
    return element;
  }

  async navigate(url: string) {
    const page = await this.getPage();
    return await trackModalChanges(page, async () => {
      await page.goto(url, {
        waitUntil: "networkidle0",
      });
    });
  }

  async click(selector: string) {
    const page = await this.getPage();
    const element = await this.getElement(selector);
    return await trackModalChanges(page, async () => {
      await element.click();
    });
  }

  async inputText(selector: string, text: string) {
    const page = await this.getPage();
    const element = await this.getElement(selector);
    return await trackModalChanges(page, async () => {
      await element.type(text);
    });
  }

  async close() {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}

export async function getHiddenElementIs(page: Page | null) {
  if (page) {
    const hiddenElementIs = await page.evaluate(() => {
      const hiddenElementIs: string[] = [];
      const elements = document.body.querySelectorAll("*");

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isHiddenByClip = style.clip === "rect(0px, 0px, 0px, 0px)";
        const isHiddenByClipPath = style.clipPath === "inset(100%)";
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.left > window.innerWidth ||
          rect.right < 0 ||
          style.visibility === "hidden" ||
          style.display === "none" ||
          isHiddenByClip ||
          isHiddenByClipPath
        ) {
          const i = el.getAttribute("i");
          if (i) hiddenElementIs.push(i);
          return;
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

import { JSDOM } from "jsdom";

function findRepeatingComponents(html: string) {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;

  function createFrequencyMap(element: Element): Map<string, number> {
    const frequencyMap: Map<string, number> = new Map();

    element.childNodes.forEach((child) => {
      if (child.nodeType === 1) {
        const childElement = child as Element;

        Array.from(childElement.classList).forEach((className) => {
          frequencyMap.set(className, (frequencyMap.get(className) || 0) + 1);
        });

        Array.from(childElement.attributes).forEach((attr) => {
          const attrKey = `${attr.name}=${attr.value}`;
          frequencyMap.set(attrKey, (frequencyMap.get(attrKey) || 0) + 1);
        });
      }
    });
    return frequencyMap;
  }

  function traverseAndFind(element: Element): Element | null {
    const frequencyMap = createFrequencyMap(element);

    for (const frequency of frequencyMap.values()) {
      if (frequency >= 3) return element;
    }

    for (const child of Array.from(element.children)) {
      const result = traverseAndFind(child as Element);
      if (result) return result;
    }

    return null;
  }

  return traverseAndFind(body);
}

async function findModals(
  page: Page,
  hiddenElementIs: string[]
): Promise<{ i: string; html: string; zIndex: number }[]> {
  return await page.evaluate((hiddenElementIs) => {
    const MIN_MODAL_SIZE = 120; // 예시: 모달이 가져야 할 최소 크기
    const MIN_Z_INDEX = 5; // 예시: 모달로 간주되려면 최소한 얼마나 높은 z-index를 가져야 하는지

    const filterHiddenElements = (
      html: string,
      hiddenElementIs: string[]
    ): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      hiddenElementIs.forEach((hiddenI) => {
        const hiddenEl = doc.querySelector(`[i="${hiddenI}"]`);
        if (hiddenEl) hiddenEl.remove();
      });
      return doc.body.innerHTML; // <body> 태그 내부의 HTML만 반환
    };

    const modals: { i: string; html: string; zIndex: number }[] = [];
    const elements = Array.from(document.body.querySelectorAll("*")).filter(
      (el) => {
        const iAttr = el.getAttribute("i");
        return iAttr && !hiddenElementIs.includes(iAttr);
      }
    );

    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(el);
      const isPositioned =
        style.position === "fixed" || style.position === "absolute";
      const isLargeEnough =
        htmlEl.offsetWidth > MIN_MODAL_SIZE &&
        htmlEl.offsetHeight > MIN_MODAL_SIZE;
      const zIndex = parseInt(style.zIndex, 10);

      if (isPositioned && isLargeEnough && zIndex >= MIN_Z_INDEX) {
        const containsInteractiveElement =
          el.querySelector("button, a, input, select, textarea") != null;
        if (containsInteractiveElement) {
          const i = el.getAttribute("i");
          if (i) {
            const filteredHtml = filterHiddenElements(
              el.outerHTML,
              hiddenElementIs
            );
            modals.push({ i, html: filteredHtml, zIndex });
          }
        }
      }
    });

    console.log("modals: ", modals);

    return modals;
  }, hiddenElementIs);
}

function getTopmostModal(
  modals: { i: string; html: string; zIndex: number }[]
): { i: string; html: string } | null {
  if (modals.length === 0) return null;

  return modals.reduce((topmost, current) => {
    return current.zIndex > topmost.zIndex ? current : topmost;
  });
}

export async function trackModalChanges(
  page: Page,
  action: () => Promise<void>
): Promise<{
  modalI: string | null;
  html: string;
}> {
  // Initial check for modals
  const initialHiddenElementIs = await getHiddenElementIs(page);
  const initialModals = await findModals(page, initialHiddenElementIs);
  const initialUrl = page.url();

  // Perform the given action
  const navigationPromise = page.waitForNavigation({
    waitUntil: "networkidle0",
  });
  await action();
  if (page.url() !== initialUrl) {
    await navigationPromise;
  } else {
    await new Promise((r) => setTimeout(r, 2000));
  }

  await addIAttribute(page);

  // Recheck for modals
  const finalHiddenElementIs = await getHiddenElementIs(page);
  const finalModals = await findModals(page, finalHiddenElementIs);
  const topmostModal = getTopmostModal(finalModals);

  const getFilteredHtml = async (
    html: string,
    hiddenElementIs: string[]
  ): Promise<string> => {
    return await page.evaluate(
      (html, hiddenElementIs) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        hiddenElementIs.forEach((hiddenI) => {
          const hiddenEl = doc.querySelector(`[i="${hiddenI}"]`);
          if (hiddenEl) hiddenEl.remove();
        });
        return doc.body.innerHTML; // <body> 태그 내부의 HTML만 반환
      },
      html,
      hiddenElementIs
    );
  };

  const html = await page.content();
  const filteredHtml = topmostModal
    ? topmostModal.html
    : await getFilteredHtml(html, finalHiddenElementIs);
  const potentialComponents = findRepeatingComponents(filteredHtml);
  console.log(potentialComponents?.outerHTML);

  // Compare initial and final modals to determine changes
  if (initialModals.length === 0 && finalModals.length === 0) {
    return { modalI: null, html: filteredHtml };
  } else if (initialModals.length === 0 && finalModals.length > 0) {
    // New modal appeared
    return {
      modalI: topmostModal?.i || null,
      html: filteredHtml,
    };
  } else if (initialModals.length > 0 && finalModals.length === 0) {
    // Modal disappeared
    return { modalI: null, html: filteredHtml };
  } else {
    // Modal changed or stayed the same
    return {
      modalI: topmostModal?.i || null,
      html: filteredHtml,
    };
  }
}
