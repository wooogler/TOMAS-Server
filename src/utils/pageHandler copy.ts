import dotenv from "dotenv";
import { JSDOM } from "jsdom";
import puppeteer, { Browser, Dialog, Page } from "puppeteer";
import { ActionType, simplifyHtml } from "./htmlHandler";
import {
  getModalDescription,
  getPageDescription,
  getScreenDescription,
  getSectionDescription,
} from "../prompts/screenPrompts";
import { Action, parsingAgent, parsingItemAgent } from "./parsingAgent";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

export type ActionComponent = {
  i: string;
  actionType: ActionType;
  description?: string;
  html: string;
};

export interface ScreenResult {
  id: string;
  type: string;
  screenDescription: string;
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

    // 필요하다면 캔버스 제거 기능 추가
    // ...
  }

  async highlightScreenResultsOriginal(screenResult: ScreenResult) {
    const page = await this.getPage();
    const { actions } = screenResult;
    for (const action of actions) {
      const selector = `[i="${action.i}"]`;
      const color =
        action.type === "click"
          ? "red"
          : action.type === "select"
          ? "blue"
          : "green";
      const element = await page.$(selector);
      if (element) {
        await page.evaluate(
          ({ selector, color }) => {
            const el = document.querySelector(selector);
            if (el) {
              (
                el as HTMLElement
              ).style.cssText = `box-shadow: 0 0 2px ${color} !important;`;
            }
          },
          { selector, color }
        );
      }
    }
  }

  // 요소를 하이라이트하는 함수
  async highlight(selector: string) {
    const page = await this.getPage();
    const elements = await page.$$(selector); // 모든 일치하는 요소들을 선택
    for (const element of elements) {
      await page.evaluate((el) => {
        // 가장 가까운 div 부모 요소를 찾습니다.
        const parentDiv = el.closest("div");
        if (parentDiv) {
          // 부모 div에 스타일을 적용합니다.
          parentDiv.style.outline = "5px solid red";
          parentDiv.classList.add("highlighted-element");
        }
      }, element);
    }
  }

  // 하이라이트를 제거하는 함수
  async removeHighlight() {
    const page = await this.getPage();
    await page.evaluate(() => {
      const highlightedDivs = document.querySelectorAll(
        "div.highlighted-element"
      );
      highlightedDivs.forEach((div) => {
        // div 요소의 하이라이트 스타일을 제거합니다.
        (div as HTMLElement).style.outline = "";
        div.classList.remove("highlighted-element");
      });
    });
  }

  async handleAction(
    parsing: boolean,
    action: () => Promise<void>
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen, scrolls } = await getScreen(page, action, true);

    if (parsing === false) {
      return {
        type: "page",
        screenDescription: "",
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
    const screenSimpleHtml = simplifyHtml(screen, true);
    const screenDescription = await getScreenDescription(screenSimpleHtml);
    const actions = await parsingAgent({
      screenHtml: screen,
      screenDescription,
    });
    return {
      type: "screen",
      screenDescription,
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

  //select one item in the list
  async select(
    selector: string,
    isFocus: boolean = false, // focus on the selected item
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen } = await getScreen(page, async () => {}, false);
    const dom = new JSDOM(screen);
    const element = dom.window.document.querySelector(selector);
    const elementSimpleHtml = simplifyHtml(element?.innerHTML || "", true);
    if (parsing === false) {
      return {
        type: "section",
        screenDescription: "",
        actions: [],
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
    const actions = isFocus
      ? await parsingAgent({
          screenHtml: element?.outerHTML || "",
          screenDescription: sectionDescription,
        })
      : await parsingItemAgent({
          screenHtml: element?.outerHTML || "",
          screenDescription: sectionDescription,
        });
    return {
      type: "section",
      screenDescription: sectionDescription,
      actions,
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
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
      };
    }
    const pageDescription = await getPageDescription(pageSimpleHtml);
    const actions = await parsingAgent({
      screenHtml: screen.html,
      screenDescription: pageDescription,
    });
    return {
      type: "page",
      screenDescription: pageDescription,
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

async function findModalsAndScrolls(
  page: Page,
  hiddenElementIs: string[]
): Promise<{
  modals: {
    i: string;
    html: string;
    zIndex: number;
  }[];
  scrolls: {
    x: string[];
    y: string[];
  };
}> {
  return await page.evaluate((hiddenElementIs) => {
    const MIN_MODAL_SIZE = 120;
    const MIN_Z_INDEX = 200;

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
    const scrolls: {
      x: string[];
      y: string[];
    } = { x: [], y: [] };
    const elements = Array.from(document.body.querySelectorAll("*")).filter(
      (el) => {
        const iAttr = el.getAttribute("i");
        return iAttr && !hiddenElementIs.includes(iAttr);
      }
    );
    console.log(elements.map((el) => el.getAttribute("i")));

    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(el);

      // Check if the element is a modal
      const isPositioned = style.position === "absolute";
      // const isPositioned = style.position === "fixed";
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

      // Check if the element is a scrollable element
      const overflowX = style.overflowX;
      const overflowY = style.overflowY;
      const isScrollableX = overflowX === "auto" || overflowX === "scroll";
      const isScrollableY = overflowY === "auto" || overflowY === "scroll";

      const iAttr = el.getAttribute("i");

      if (isScrollableX && iAttr) scrolls.x.push(iAttr);
      if (isScrollableY && iAttr) scrolls.y.push(iAttr);
    });

    return { modals, scrolls };
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

export async function getScreen(
  page: Page,
  action: () => Promise<void>,
  isAction: boolean
): Promise<{
  screen: string;
  scrolls: { x: string[]; y: string[] };
}> {
  await action();
  await new Promise((r) => setTimeout(r, 1000));

  await addIAttribute(page);
  await markClickableDivs(page);

  const hiddenElementIs = await getHiddenElementIs(page, isAction);
  const { screen, scrolls } = await findScreenAndScrolls(page, hiddenElementIs);

  return { screen, scrolls };
}

export async function trackModalChanges(
  page: Page,
  action: () => Promise<void>
): Promise<{
  modalI: string | null;
  html: string;
}> {
  // Initial check for modals
  const initialHiddenElementIs = await getHiddenElementIs(page, false);
  const { modals: initialModals } = await findModalsAndScrolls(
    page,
    initialHiddenElementIs
  );

  console.log("initialModals", initialModals);

  await action();
  await new Promise((r) => setTimeout(r, 1000));

  await addIAttribute(page);
  await markClickableDivs(page);

  // Recheck for modals
  const finalHiddenElementIs = await getHiddenElementIs(page, false);
  const { modals: finalModals, scrolls } = await findModalsAndScrolls(
    page,
    finalHiddenElementIs
  );

  console.log("finalModals", finalModals);

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
