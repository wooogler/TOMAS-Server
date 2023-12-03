import dotenv from "dotenv";
import { JSDOM } from "jsdom";
import puppeteer, { Browser, Page } from "puppeteer";
import { simplifyHtml, simplifyItemHtml } from "./htmlHandler";
import {
  getListDescription,
  getScreenDescription,
  getSectionDescription,
  getSectionLongState,
  getSectionState,
} from "../prompts/screenPrompts";
import {
  Action,
  modifySelectAction,
  parsingAgent,
  parsingItemAgent,
  parsingListAgent,
} from "../agents/parsingAgent";
import { Prompt, getAiResponse, getGpt4Response } from "./langchainHandler";
import { getChats } from "../modules/chat/chat.service";
import { loadObjectArrayFromFile, saveObjectArrayToFile } from "./fileUtil";
import { SystemLog, getActionHistory } from "../prompts/actionPrompts";

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
  screenState?: string;
  actions: Action[];
  screenHtml: string;
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

    // 픽셀 4 XL에 맞는 유저 에이전트 설정
    await this.page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 10; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.92 Mobile Safari/537.36"
    );
    // 뷰포트 설정에 해상도 및 deviceScaleFactor를 설정
    await this.page.setViewport({
      width: 412,
      height: 869,
      deviceScaleFactor: 3.5,
    });
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

  async scrollToElement(selector: string) {
    const page = await this.getPage();
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }, selector);
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
      canvas.width = window.innerWidth;
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
              // 깜빡임 효과를 위한 변수
              let visible = true;

              // 깜빡임 효과 함수
              const blink = () => {
                if (visible) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                } else {
                  ctx.strokeRect(
                    rect.left + borderWidth / 2,
                    rect.top + borderWidth / 2,
                    rect.width - borderWidth,
                    rect.height - borderWidth
                  );
                }
                visible = !visible;
              };

              // 일정 간격으로 깜빡임 효과 적용
              setInterval(blink, 500); // 500ms 간격으로 깜빡임
            }
          }
        }
      },
      { selector, borderWidth: 5 }
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
    const { screen, scrolls, screenChangeType, screenType, pageHtml } =
      await getScreen(page, action, true);

    if (parsing === false) {
      return {
        type: screenType,
        screenDescription: "",
        screenDescriptionKorean: "",
        actions: [],
        screenChangeType: "STATE_CHANGE",
        id: `${this.extractBaseURL(page.url())}`,
        screenHtml: screen,
      };
    }
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(screen, screenType);

    const actions = await parsingAgent({
      screenHtml: screen,
      screenDescription,
      pageHtml,
    });
    return {
      type: screenType,
      screenDescription,
      screenDescriptionKorean,
      screenChangeType,
      actions,
      id: `${this.extractBaseURL(page.url())}`,
      screenHtml: screen,
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

    // 이전에 설정된 대화 상자 핸들러 제거
    page.removeAllListeners("dialog");

    // 대화 상자가 나타날 때 단 한 번만 자동으로 수락
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    return this.handleAction(parsing, async () => {
      await this.scrollToElement(selector);
      await new Promise((r) => setTimeout(r, 500));
      await element.click();
    });
  }

  async inputText(
    selector: string,
    text: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    return this.handleAction(parsing, async () => {
      await this.scrollToElement(selector);
      await new Promise((r) => setTimeout(r, 500));
      await page.$eval(
        selector,
        (input) => ((input as HTMLInputElement).value = "")
      );
      await page.type(selector, text);
    });
  }

  async modifyState(
    selector: string,
    userRequest: string,
    mode: "one" | "state" | "history",
    oldActions: Action[] = []
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    let { screen, screenType, pageHtml } = await getScreen(
      page,
      async () => {},
      false
    );
    const dom = new JSDOM(screen);
    const section = dom.window.document.querySelector(selector);
    const sectionHtml = await page.evaluate((selector) => {
      const section = document.querySelector(selector);
      if (!section) return "";
      const inputs = section.querySelectorAll("input");
      inputs.forEach((input) => {
        input.setAttribute("value", input.value);
      });

      return section.outerHTML;
    }, selector);
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(screen, screenType);
    const { sectionDescription, sectionDescriptionKorean } =
      await getSectionDescription(sectionHtml, screenDescription);

    const { sectionState } =
      mode === "state"
        ? await getSectionState(sectionHtml)
        : { sectionState: "No State" };
    let actions = await parsingAgent({
      screenHtml: sectionHtml,
      screenDescription,
      pageHtml,
      excludeSelectable: true,
    });

    const selectOneNextActionPrompt: Prompt = {
      role: "SYSTEM",
      content: `As an agent, your task is to select the most suitable next action for the current situation considering the user's request
Evaluate the available options and choose one action with "(i=##)" that seems most appropriate.

User's request: ${userRequest}

Description of the section: ${sectionDescription}

Available actions:
${actions.map((comp) => `- ${comp.content} (i=${comp.i})`).join("\n")}`,
    };

    const selectNextActionWithStatePrompt: Prompt = {
      role: "SYSTEM",
      content: `You are an agent tasked with modifying the state of the section according to the user's request. 
Your goal is to select one next action with "(i=##)" that is most appropriate for the current situation. 
After each action, the state of the screen will change, and new actions may become available. 
Think step by step, and select only one action at a time. 
If you determine that no further actions are necessary to achieve the user's goal or to maintain the desired state of the screen, please output 'done'.

user's request: ${userRequest}

Description of the section: ${sectionDescription}

Current section state: ${sectionState}

Available actions:
${actions.map((comp) => `- ${comp.content} (i=${comp.i})`).join("\n")}
`,
    };

    const selectNextActionWithHistoryPrompt: Prompt = {
      role: "SYSTEM",
      content: `As an agent, your task is to select one next action for the current situation, considering both the user's request and the history of previous actions taken. 
Reflect on the sequence of actions already performed and their outcomes to make an informed decision about the next step. 
Evaluate the available options based on this historical context and output one action with "(i=##)" that seems most appropriate. 
If you determine that no further actions are needed or beneficial, please output 'done'.

User's request: ${userRequest}

Description of the section: ${sectionDescription}

History of previous actions: 
${oldActions.map((comp) => `- ${comp.content}`).join("\n")}

Available actions:
${actions.map((comp) => `- ${comp.content} (i=${comp.i})`).join("\n")}`,
    };

    switch (mode) {
      case "one":
        console.log(selectOneNextActionPrompt.content);
        break;
      case "state":
        console.log(selectNextActionWithStatePrompt.content);
        break;
      case "history":
        console.log(selectNextActionWithHistoryPrompt.content);
        break;
    }

    const response =
      mode === "history"
        ? await getGpt4Response([selectNextActionWithHistoryPrompt])
        : mode === "state"
        ? await getGpt4Response([selectNextActionWithStatePrompt])
        : await getGpt4Response([selectOneNextActionPrompt]);
    console.log(response);

    const iRegex = /\(i=(\d+)\)/;
    const iMatch = response.match(iRegex);
    const action = actions.find((comp) => comp.i === Number(iMatch?.[1]));
    let showDialog = false;

    if (action) {
      if (action.type === "click") {
        await this.scrollToElement(`[i="${action.i}"]`);
        const actionLogs =
          loadObjectArrayFromFile<SystemLog>("actionLogs.json");
        const actionDescription = await getActionHistory(action, "yes");
        actionLogs.push({
          type: screenType,
          id: `${this.extractBaseURL(page.url())}`,
          screenDescription,
          actionDescription,
          screenChangeType: "STATE_CHANGE",
        });
        saveObjectArrayToFile(actionLogs, "actionLogs.json");
        new Promise((r) => setTimeout(r, 200));
        if (mode === "one") {
          await this.highlight(`[i="${action.i}"]`);
          new Promise((r) => setTimeout(r, 2000));
          await this.removeHighlight();
          return await this.click(`[i="${action.i}"]`);
        }
        page.removeAllListeners("dialog");

        page.once("dialog", async (dialog) => {
          showDialog = true;
          try {
            await dialog.accept();
          } catch (error) {
            console.error("Error handling dialog:", error);
          }
        });
        await page.click(`[i="${action.i}"]`);
        new Promise((r) => setTimeout(r, 200));
        console.log(showDialog);
      } else if (action.type === "input") {
        // input은 필요할 때 구현
      }

      if (mode !== "one" && showDialog === false) {
        return await this.modifyState(selector, userRequest, mode, [
          ...oldActions,
          action,
        ]);
      }
    }
    console.log("done");
    ({ screen, screenType, pageHtml } = await getScreen(
      await this.getPage(),
      async () => {},
      false
    ));
    const newScreenDescription = await getScreenDescription(screen, screenType);
    actions = await parsingAgent({
      screenHtml: screen,
      screenDescription,
      pageHtml,
    });
    return {
      type: screenType,
      screenDescription: newScreenDescription.screenDescription,
      screenDescriptionKorean: newScreenDescription.screenDescriptionKorean,
      screenChangeType: "STATE_CHANGE",
      actions,
      id: `${this.extractBaseURL(page.url())}`,
      screenHtml: screen,
    };
  }

  async select(
    selector: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen, screenType } = await getScreen(page, async () => {}, false);

    const dom = new JSDOM(screen);
    const screenElement = dom.window.document.body as Element;
    const listElement = dom.window.document.querySelector(selector) as Element;
    if (parsing === false) {
      return {
        type: screenType,
        screenDescription: "",
        screenDescriptionKorean: "",
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
        screenChangeType: "STATE_CHANGE",
        screenHtml: screen,
      };
    }
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(screen, screenType);

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
      type: screenType,
      screenDescription: listDescription,
      screenDescriptionKorean: listDescriptionKorean,
      actions,
      id: `${this.extractBaseURL(
        page.url()
      )}section/${listElement?.getAttribute("i")}`,
      screenChangeType: "STATE_CHANGE",
      screenHtml: screen,
    };
  }

  async focus(
    selector: string,
    parsing: boolean = true
  ): Promise<ScreenResult> {
    const page = await this.getPage();
    await this.scrollToElement(selector);
    await new Promise((r) => setTimeout(r, 200));
    const { screen, screenType } = await getScreen(page, async () => {}, false);
    const dom = new JSDOM(screen);
    const element = dom.window.document.querySelector(selector);
    const { listDescription, listDescriptionKorean } = await getListDescription(
      screen,
      screenType
    );

    if (parsing === false) {
      return {
        type: "item",
        screenDescription: "",
        screenDescriptionKorean: "",
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
        screenChangeType: "STATE_CHANGE",
        screenHtml: screen,
      };
    }

    const actions = await parsingItemAgent({
      elementHtml: element?.outerHTML || "",
      listDescription,
    });

    return {
      type: "item",
      screenDescription: listDescription,
      screenDescriptionKorean: listDescriptionKorean,
      actions,
      id: `${this.extractBaseURL(page.url())}`,
      screenChangeType: "STATE_CHANGE",
      screenHtml: screen,
    };
  }

  async unfocus(parsing: boolean = true): Promise<ScreenResult> {
    const page = await this.getPage();
    const { screen, screenChangeType, screenType, pageHtml } = await getScreen(
      page,
      async () => {},
      true
    );

    if (parsing === false) {
      return {
        type: "page",
        screenDescription: "",
        screenDescriptionKorean: "",
        screenChangeType,
        actions: [],
        id: `${this.extractBaseURL(page.url())}`,
        screenHtml: screen,
      };
    }
    const { screenDescription, screenDescriptionKorean } =
      await getScreenDescription(screen, screenType);
    const actions = await parsingAgent({
      screenHtml: screen,
      screenDescription,
      pageHtml,
    });
    return {
      type: "page",
      screenDescription,
      screenDescriptionKorean,
      screenChangeType,
      actions,
      id: `${this.extractBaseURL(page.url())}`,
      screenHtml: screen,
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
            rect.width < 3 ||
            rect.height < 3 ||
            style.visibility === "hidden" ||
            style.display === "none" ||
            isHiddenByClip ||
            isHiddenByClipPath ||
            isCovered
          );
        } else {
          return (
            rect.width < 3 ||
            rect.height < 3 ||
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
): Promise<{
  screen: string;
  scrolls: { x: string[]; y: string[] };
  screenType: ScreenType;
  pageHtml: string;
}> {
  return await page.evaluate((hiddenElementIs) => {
    const clonedBody = document.body.cloneNode(true) as HTMLElement;

    // hiddenElementIs에 해당하는 요소를 제외하고 z-index 계산
    let highestZIndex = 0;
    let screenType: ScreenType = "page";

    document.querySelectorAll("body *").forEach((el) => {
      if (el instanceof HTMLElement) {
        const elIAttr = el.getAttribute("i");
        if (elIAttr !== null && !hiddenElementIs.includes(elIAttr)) {
          const zIndex = parseInt(window.getComputedStyle(el).zIndex, 10);
          if (!isNaN(zIndex)) {
            highestZIndex = Math.max(highestZIndex, zIndex);
          }
        }
      }
    });

    if (highestZIndex > 999) {
      // 임계값 설정 (예: 1000)
      screenType = "modal";
    }

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
      screenType,
      pageHtml: document.body.innerHTML,
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

export type ScreenType = "page" | "modal";

export async function getScreen(
  page: Page,
  action: () => Promise<void>,
  isAction: boolean
): Promise<{
  screen: string;
  scrolls: { x: string[]; y: string[] };
  screenChangeType: ScreenChangeType;
  screenType: ScreenType;
  pageHtml: string;
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

  const { screen, scrolls, screenType, pageHtml } = await findScreenAndScrolls(
    page,
    hiddenElementIs
  );

  return { screen, scrolls, screenChangeType, screenType, pageHtml };
}
