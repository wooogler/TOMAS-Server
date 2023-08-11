import { JSDOM } from "jsdom";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  ActionType,
  parsingAgent,
  parsingItemAgent,
  simplifyHtml,
} from "./htmlHandler";
import {
  getModalDescription,
  getPageDescription,
  getSectionDescription,
} from "./langchainHandler";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

export type ActionComponent = {
  i: string;
  actionType: ActionType;
  description?: string;
  html: string;
};

export interface ScreenResult {
  id: string;
  type: "page" | "section" | "modal";
  screenDescription: string;
  actionComponents: ActionComponent[];
}

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

  private extractBaseURL(url: string) {
    const parsedURL = new URL(url);
    return parsedURL.origin + parsedURL.pathname;
  }

  async navigate(url: string, parsing: boolean = true): Promise<ScreenResult> {
    const page = await this.getPage();
    await page.setDefaultNavigationTimeout(0);
    const screen = await trackModalChanges(page, async () => {
      await page.goto(url, {
        waitUntil: "networkidle0",
      });
    });

    if (parsing === false) {
      if (screen.modalI) {
        return {
          type: "modal",
          screenDescription: "",
          actionComponents: [],
          id: `${this.extractBaseURL(page.url())}modal/${screen.modalI}`,
        };
      } else {
        return {
          type: "page",
          screenDescription: "",
          actionComponents: [],
          id: `${this.extractBaseURL(page.url())}`,
        };
      }
    }

    const pageSimpleHtml = simplifyHtml(await page.content(), true);
    const pageDescription = await getPageDescription(pageSimpleHtml);
    const screenSimpleHtml = simplifyHtml(screen.html, true);
    if (screen.modalI) {
      // if screen is a modal
      const modalDescription = await getModalDescription(
        screenSimpleHtml,
        pageDescription
      );
      const actionComponents = await parsingAgent({
        screenHtml: screen.html,
        screenDescription: modalDescription,
      });
      return {
        type: "modal",
        screenDescription: modalDescription,
        actionComponents,
        id: `${this.extractBaseURL(page.url())}modal/${screen.modalI}`,
      };
    } else {
      const actionComponents = await parsingAgent({
        screenHtml: screen.html,
        screenDescription: pageDescription,
      });

      return {
        type: "page",
        screenDescription: pageDescription,
        actionComponents,
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
  }

  async click(
    selector: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const element = await this.getElement(selector);
    const screen = await trackModalChanges(page, async () => {
      await element.click();
    });
    console.log(screen.modalI);

    if (parsing === false) {
      if (screen.modalI) {
        return {
          type: "modal",
          screenDescription: "",
          actionComponents: [],
          id: `${this.extractBaseURL(page.url())}modal/${screen.modalI}`,
        };
      } else {
        return {
          type: "page",
          screenDescription: "",
          actionComponents: [],
          id: `${this.extractBaseURL(page.url())}`,
        };
      }
    }

    const pageSimpleHtml = simplifyHtml(await page.content(), true);
    const pageDescription = await getPageDescription(pageSimpleHtml);
    const screenSimpleHtml = simplifyHtml(screen.html, true);

    if (screen.modalI) {
      // if screen is a modal
      const modalDescription = await getModalDescription(
        screenSimpleHtml,
        pageDescription
      );
      const actionComponents = await parsingAgent({
        screenHtml: screen.html,
        screenDescription: modalDescription,
      });
      return {
        type: "modal",
        screenDescription: modalDescription,
        actionComponents,
        id: `${this.extractBaseURL(page.url())}modal/${screen.modalI}`,
      };
    } else {
      const actionComponents = await parsingAgent({
        screenHtml: screen.html,
        screenDescription: pageDescription,
      });

      return {
        type: "page",
        screenDescription: pageDescription,
        actionComponents,
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
  }

  async inputText(
    selector: string,
    text: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const element = await this.getElement(selector);
    const screen = await trackModalChanges(page, async () => {
      await element.type(text);
    });
    if (parsing === false) {
      if (screen.modalI) {
        return {
          type: "modal",
          screenDescription: "",
          actionComponents: [],
          id: `${this.extractBaseURL(page.url())}modal/${screen.modalI}`,
        };
      } else {
        return {
          type: "page",
          screenDescription: "",
          actionComponents: [],
          id: `${this.extractBaseURL(page.url())}`,
        };
      }
    }

    const pageSimpleHtml = simplifyHtml(await page.content(), true);
    const pageDescription = await getPageDescription(pageSimpleHtml);
    const screenSimpleHtml = simplifyHtml(screen.html, true);

    if (screen.modalI) {
      // if screen is a modal
      const modalDescription = await getModalDescription(
        screenSimpleHtml,
        pageDescription
      );
      const actionComponents = await parsingAgent({
        screenHtml: screen.html,
        screenDescription: modalDescription,
      });
      return {
        type: "modal",
        screenDescription: modalDescription,
        actionComponents,
        id: `${this.extractBaseURL(page.url())}modal/${screen.modalI}`,
      };
    } else {
      const actionComponents = await parsingAgent({
        screenHtml: screen.html,
        screenDescription: pageDescription,
      });

      return {
        type: "page",
        screenDescription: pageDescription,
        actionComponents,
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
  }

  //select one item in the list
  async select(
    selector: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const screen = await trackModalChanges(page, async () => {});
    const dom = new JSDOM(screen.html);
    const element = dom.window.document.querySelector(selector);
    const elementSimpleHtml = simplifyHtml(element?.innerHTML || "", true);

    if (parsing === false) {
      return {
        type: "section",
        screenDescription: "",
        actionComponents: [],
        id: `${this.extractBaseURL(page.url())}section/${element?.getAttribute(
          "i"
        )}`,
      };
    }
    const pageSimpleHtml = simplifyHtml(await page.content(), true);
    const pageDescription = await getPageDescription(pageSimpleHtml);
    const sectionDescription = await getSectionDescription(
      elementSimpleHtml,
      pageDescription
    );
    const itemComponents = await parsingItemAgent({
      screenHtml: element?.innerHTML || "",
      pageDescription,
    });
    return {
      type: "section",
      screenDescription: sectionDescription,
      actionComponents: itemComponents,
      id: `${this.extractBaseURL(page.url())}section/${element?.getAttribute(
        "i"
      )}`,
    };
  }

  async unfocus(parsing: boolean = true): Promise<ScreenResult> {
    const page = await this.getPage();
    const screen = await trackModalChanges(page, async () => {});
    const screenSimpleHtml = simplifyHtml(screen.html, true);

    const pageSimpleHtml = simplifyHtml(await page.content(), true);
    if (parsing === false) {
      return {
        type: "page",
        screenDescription: "",
        actionComponents: [],
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
    const pageDescription = await getPageDescription(pageSimpleHtml);
    const actionComponents = await parsingAgent({
      screenHtml: screen.html,
      screenDescription: pageDescription,
    });
    return {
      type: "page",
      screenDescription: pageDescription,
      actionComponents,
      id: `${this.extractBaseURL(page.url())}`,
    };
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

async function findModals(
  page: Page,
  hiddenElementIs: string[]
): Promise<{ i: string; html: string; zIndex: number }[]> {
  return await page.evaluate((hiddenElementIs) => {
    const MIN_MODAL_SIZE = 120;
    const MIN_Z_INDEX = 5;

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

async function markClickableDivs(page: Page): Promise<void> {
  await page.$$eval("div", (divs: HTMLDivElement[]) => {
    divs.forEach((div) => {
      const style = window.getComputedStyle(div);
      if (style.cursor === "pointer") {
        div.setAttribute("clickable", "true");
      }
    });
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

  await action();
  if (page.url() !== initialUrl) {
    // await navigationPromise;
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    await new Promise((r) => setTimeout(r, 3000));
  }

  await addIAttribute(page);
  await markClickableDivs(page);

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
