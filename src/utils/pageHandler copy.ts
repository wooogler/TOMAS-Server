import dotenv from "dotenv";
import { JSDOM } from "jsdom";
import puppeteer, { Browser, Page } from "puppeteer";
import { simplifyHtml, simplifyItemHtml } from "./htmlHandler";
import {
  getListDescription,
  getModalDescription,
  getPageDescription,
  getScreenDescription,
} from "../prompts/screenPrompts";
import {
  Action,
  modifySelectAction,
  parsingAgent,
  parsingItemAgent,
  parsingListAgent,
} from "./parsingAgent";
import { Prompt, getAiResponse, getGpt4Response } from "./langchainHandler";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

export type ActionComponent = {
  i: string;
  actionType: string;
  description?: string;
  html: string;
};

export interface ScreenResult {
  id: string;
  type: string;
  screenDescription: string;
  screenDescriptionKorean: string;
  screenChangeType: ScreenChangeType;
  actions: Action[];
}

export class PageHandler {
  private browser: Browser | null = null;
  private page: Page | null = null;
  async initialize() {
    dotenv.config();
    this.browser = await puppeteer.launch({
      headless: false,
      args: ["--window-size=1000,1000"],
    });

    const pages = await this.browser.pages();
    this.page = pages[0];

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
  async highlightScreenResults(screenResult: ScreenResult) {
    const page = await this.getPage();
    const { actions } = screenResult;

    // 캔버스 요소 추가
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.id = "highlight-canvas";
      canvas.width = window.innerWidth; // 실제 드로잉 영역의 크기 설정
      canvas.height = window.innerHeight;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "1000000";
      canvas.style.pointerEvents = "none";
      document.body.appendChild(canvas);
    });

    for (const action of actions) {
      const selector = `[i="${action.i}"]`;
      const color =
        action.type === "click"
          ? "red"
          : action.type === "select"
          ? "blue"
          : "green";

      // 캔버스에 하이라이트 그리기
      await page.evaluate(
        ({ selector, color, borderWidth }) => {
          const el = document.querySelector(selector);
          if (el) {
            const canvasElement = document.getElementById("highlight-canvas");
            // HTMLCanvasElement로 타입 캐스팅
            if (canvasElement instanceof HTMLCanvasElement) {
              const ctx = canvasElement.getContext("2d");
              if (ctx) {
                const rect = el.getBoundingClientRect();
                ctx.strokeStyle = color;
                ctx.lineWidth = borderWidth;
                ctx.strokeRect(
                  rect.left + borderWidth / 2,
                  rect.top + borderWidth / 2,
                  rect.width - borderWidth,
                  rect.height - borderWidth
                );
              }
            }
          }
        },
        { selector, color, borderWidth: 4 }
      );
    }
  }

  async highlight(selector: string) {
    const page = await this.getPage();
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.id = "highlight-canvas";
      canvas.width = window.innerWidth; // 실제 드로잉 영역의 크기 설정
      canvas.height = window.innerHeight;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "1000000";
      canvas.style.pointerEvents = "none";
      document.body.appendChild(canvas);
    });
    await page.evaluate(
      ({ selector, borderWidth }) => {
        const element = document.querySelector(selector);
        if (element) {
          const canvas = document.getElementById("highlight-canvas");
          if (canvas instanceof HTMLCanvasElement) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const rect = element.getBoundingClientRect();
              ctx.strokeStyle = "red";
              ctx.lineWidth = borderWidth;
              ctx.strokeRect(
                rect.left + borderWidth / 2,
                rect.top + borderWidth / 2,
                rect.width - borderWidth,
                rect.height - borderWidth
              );
            }
          }
        }
      },
      { selector, borderWidth: 4 }
    );
  }

  async removeHighlight() {
    const page = await this.getPage();
    await page.evaluate(() => {
      const canvas = document.getElementById("highlight-canvas");
      if (canvas) {
        canvas.remove();
      }
    });
  }

  async handleAction(
    parsing: boolean,
    action: () => Promise<void>
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen, scrolls, screenChangeType } = await getScreen(
      page,
      action,
      true
    );

    if (parsing === false) {
      return {
        type: "page",
        screenDescription: "",
        screenDescriptionKorean: "",
        actions: [],
        screenChangeType: "STATE_CHANGE",
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
    const screenSimpleHtml = simplifyHtml(screen, true);
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(screenSimpleHtml);
    const actions = await parsingAgent({
      screenHtml: screen,
      screenDescription,
    });
    return {
      type: "screen",
      screenDescription,
      screenDescriptionKorean,
      screenChangeType,
      actions,
      id: `${this.extractBaseURL(page.url())}`,
    };
  }

  async navigate(url: string, parsing: boolean = true): Promise<ScreenResult> {
    const page = await this.getPage();
    return this.handleAction(parsing, async () => {
      await await page.goto(url, {
        waitUntil: "networkidle0",
      });
    });
  }

  async click(
    selector: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const element = await this.getElement(selector);
    return this.handleAction(parsing, async () => {
      await element.click();
      // alert 창이 나타날 때 자동으로 수락
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });
    });
  }

  async inputText(
    selector: string,
    text: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    return this.handleAction(parsing, async () => {
      await page.$eval(
        selector,
        (input) => ((input as HTMLInputElement).value = "")
      );
      await page.type(selector, text);
    });
  }

  async select(
    selector: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen } = await getScreen(page, async () => {}, false);
    const dom = new JSDOM(screen);
    const screenElement = dom.window.document.body as Element;
    const listElement = dom.window.document.querySelector(selector) as Element;
    if (parsing === false) {
      return {
        type: "section",
        screenDescription: "",
        screenDescriptionKorean: "",
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
        screenChangeType: "STATE_CHANGE",
      };
    }
    const screenSimpleHtml = simplifyHtml(screen, true);
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(screenSimpleHtml);

    const listHtml = modifySelectAction(listElement, screenElement);
    const listSimpleHtml = simplifyHtml(listHtml?.outerHTML || "", true);
    const { listDescription, listDescriptionKorean } = await getListDescription(
      listSimpleHtml,
      screenDescription
    );

    const actions = await parsingListAgent({
      listHtml: listElement?.outerHTML || "",
    });

    return {
      type: "section",
      screenDescription: listDescription,
      screenDescriptionKorean: listDescriptionKorean,
      actions,
      id: `${this.extractBaseURL(
        page.url()
      )}section/${listElement?.getAttribute("i")}`,
      screenChangeType: "STATE_CHANGE",
    };
  }

  async focus(
    selector: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen } = await getScreen(page, async () => {}, false);
    const dom = new JSDOM(screen);
    const element = dom.window.document.querySelector(selector);
    const screenSimpleHtml = simplifyHtml(screen, true);
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(screenSimpleHtml);

    if (parsing === false) {
      return {
        type: "item",
        screenDescription: "",
        screenDescriptionKorean: "",
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
        screenChangeType: "STATE_CHANGE",
      };
    }

    const actions = await parsingItemAgent({
      elementHtml: element?.outerHTML || "",
      screenDescription,
    });

    return {
      type: "item",
      screenDescription,
      screenDescriptionKorean,
      actions,
      id: `${this.extractBaseURL(page.url())}`,
      screenChangeType: "STATE_CHANGE",
    };
  }

  async unfocus(parsing: boolean = true): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen, screenChangeType } = await getScreen(
      page,
      async () => {},
      true
    );
    const screenSimpleHtml = simplifyHtml(screen, true);
    const pageSimpleHtml = simplifyHtml(await page.content(), true);
    if (parsing === false) {
      return {
        type: "page",
        screenDescription: "",
        screenDescriptionKorean: "",
        screenChangeType,
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(pageSimpleHtml);
    const actions = await parsingAgent({
      screenHtml: screen,
      screenDescription,
    });
    return {
      type: "page",
      screenDescription,
      screenDescriptionKorean,
      screenChangeType,
      actions,
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

//isOutHidden: true -> 밖에 있는 요소를 hidden으로 처리
export async function getHiddenElementIs(
  page: Page | null,
  isOutHidden: boolean
) {
  if (page) {
    const hiddenElementIs = await page.evaluate((isOutHidden) => {
      const hiddenElementIs: string[] = [];
      const elements = document.body.querySelectorAll("*");

      const isElementHidden = (el: Element) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isHiddenByClip = style.clip === "rect(0px, 0px, 0px, 0px)";
        const isHiddenByClipPath = style.clipPath === "inset(100%)";
        const margin = -10;

        const isOutOfViewport =
          rect.bottom < 0 + margin ||
          rect.right < 0 + margin ||
          rect.left > window.innerWidth - margin;

        const isCovered = (() => {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const topElement = document.elementFromPoint(centerX, centerY);
          return topElement !== el && el.contains(topElement) === false;
        })();
        if (isOutHidden) {
          return (
            rect.width === 0 ||
            rect.height === 0 ||
            style.visibility === "hidden" ||
            style.display === "none" ||
            isHiddenByClip ||
            isHiddenByClipPath ||
            isCovered
          );
        } else {
          return (
            rect.width === 0 ||
            rect.height === 0 ||
            style.visibility === "hidden" ||
            style.display === "none" ||
            isHiddenByClip ||
            isHiddenByClipPath
          );
        }
      };
      const isAnyChildVisible = (parent: Element) => {
        const children = parent.querySelectorAll("*");
        for (const child of children) {
          if (!isElementHidden(child)) {
            return true;
          }
        }
        return false;
      };

      elements.forEach((el) => {
        if (isElementHidden(el)) {
          if (!isAnyChildVisible(el)) {
            const i = el.getAttribute("i");
            if (i) {
              hiddenElementIs.push(i);
            }
          }
        }
      });

      return hiddenElementIs;
    }, isOutHidden);

    return hiddenElementIs;
  }
  throw NO_PAGE_ERROR;
}

export async function addIAttribute(page: Page) {
  if (page) {
    return await page.evaluate(() => {
      let idCounter = 0;
      const elements = Array.from(document.body.querySelectorAll("*"));
      const addedAttributes = [];

      // Add 'i' attribute to the body element
      document.body.setAttribute("i", String(idCounter));
      addedAttributes.push(String(idCounter));
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
          addedAttributes.push(String(idCounter));
          idCounter++;
        }
      });

      return addedAttributes;
    });
  } else {
    throw NO_PAGE_ERROR;
  }
}

async function findScreenAndScrolls(
  page: Page,
  hiddenElementIs: string[]
): Promise<{ screen: string; scrolls: { x: string[]; y: string[] } }> {
  return await page.evaluate((hiddenElementIs) => {
    const clonedBody = document.body.cloneNode(true) as HTMLElement;

    const removeHiddenElements = (
      hiddenElementIs: string[],
      context: HTMLElement
    ) => {
      hiddenElementIs.forEach((hiddenI) => {
        const hiddenEl = context.querySelector(`[i="${hiddenI}"]`);
        if (hiddenEl) hiddenEl.remove();
      });
    };

    removeHiddenElements(hiddenElementIs, clonedBody);

    const scrolls: {
      x: string[];
      y: string[];
    } = { x: [], y: [] };

    clonedBody.querySelectorAll("*").forEach((el) => {
      if (el instanceof HTMLElement) {
        const iAttr = el.getAttribute("i");
        if (iAttr) {
          const style = window.getComputedStyle(el);
          const overflowX = style.overflowX;
          const overflowY = style.overflowY;
          const isScrollableX = overflowX === "auto" || overflowX === "scroll";
          const isScrollableY = overflowY === "auto" || overflowY === "scroll";
          if (isScrollableX) scrolls.x.push(iAttr);
          if (isScrollableY) scrolls.y.push(iAttr);
        }
      }
    });

    return {
      screen: clonedBody.innerHTML,
      scrolls,
    };
  }, hiddenElementIs);
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

export type ScreenChangeType =
  | "OPEN_LAYER"
  | "CLOSE_LAYER"
  | "STATE_CHANGE"
  | "URL_CHANGE";

export async function getScreen(
  page: Page,
  action: () => Promise<void>,
  isAction: boolean
): Promise<{
  screen: string;
  scrolls: { x: string[]; y: string[] };
  screenChangeType: ScreenChangeType;
}> {
  const oldUrl = page.url();
  const oldHiddenElementIs = await getHiddenElementIs(page, isAction);

  await action();
  await new Promise((r) => setTimeout(r, 1000));

  const newUrl = page.url();
  const urlChanged = oldUrl !== newUrl;

  const addedI = await addIAttribute(page);
  await markClickableDivs(page);

  const hiddenElementIs = await getHiddenElementIs(page, isAction);

  let screenChangeType: ScreenChangeType;

  if (urlChanged) {
    screenChangeType = "URL_CHANGE";
  } else {
    const hidden = hiddenElementIs.filter(
      (item) => !oldHiddenElementIs.includes(item)
    );
    const appear = oldHiddenElementIs.filter(
      (item) => !hiddenElementIs.includes(item)
    );

    if (addedI.length > 5) {
      screenChangeType = "OPEN_LAYER";
    } else if (appear.length > 10 && hidden.length < 10) {
      screenChangeType = "CLOSE_LAYER";
    } else {
      screenChangeType = "STATE_CHANGE";
    }
  }

  const { screen, scrolls } = await findScreenAndScrolls(page, hiddenElementIs);

  return { screen, scrolls, screenChangeType };
}
