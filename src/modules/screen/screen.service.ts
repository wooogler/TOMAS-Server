import puppeteer, { Browser, Page } from "puppeteer";
import {
  NavigateInput,
  ClickInput,
  HoverInput,
  ScrollInput,
  TextInput,
} from "./screen.schema";
import {
  ActionComponent,
  extractActionComponents,
  removeAttributeI,
  simplifyHtml,
} from "../../utils/htmlHandler";
import prisma from "../../utils/prisma";
import { Component, Interaction, Prisma } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PrismaVectorStore } from "langchain/vectorstores/prisma";
import { minify } from "html-minifier-terser";

import {
  ComponentInfo,
  getComponentInfo,
  getInteractionOrQuestion,
  getScreenDescription,
  getTaskOrder,
  getUserObjective,
  isSuggestedInteraction,
} from "../../utils/langchainHandler";
import {
  detectChangedElements,
  getAllElementIs,
  getContentHTML,
  getHiddenElementIs,
} from "../../utils/pageHandler";

declare global {
  interface Window {
    onMutation: (mutation: any) => void;
  }
}

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

const NO_GLOBAL_PAGE_ERROR = new Error("Cannot find globalPage.");

const vectorStore = PrismaVectorStore.withModel<Component>(prisma).create(
  new OpenAIEmbeddings(),
  {
    prisma: Prisma,
    tableName: "Component",
    vectorColumnName: "vector",
    columns: {
      id: PrismaVectorStore.IdColumn,
      description: PrismaVectorStore.ContentColumn,
    },
  }
);

// async function addIAttribute() {
//   if (globalPage) {
//     await globalPage.evaluate(() => {
//       let idCounter = 0;
//       const elements = document.querySelectorAll("*");
//       elements.forEach((el) => {
//         el.setAttribute("i", String(idCounter));
//         idCounter++;
//       });
//     });
//   } else {
//     throw NO_GLOBAL_PAGE_ERROR;
//   }
// }

async function addUniqueIAttribute() {
  if (globalPage) {
    await globalPage.evaluate(() => {
      function closestElementWithId(element: HTMLElement): HTMLElement | null {
        if (element.id) return element;
        return element.parentElement
          ? closestElementWithId(element.parentElement)
          : null;
      }

      function generateUniqueIdentifier(
        element: HTMLElement,
        closestIdElem: HTMLElement | null
      ): string {
        const closestId = closestIdElem ? closestIdElem.id : "";
        const additionalInfo = element.tagName + ">" + element.className;
        return closestId + ">" + additionalInfo;
      }

      const allElements = document.querySelectorAll("*");
      allElements.forEach((el: Element) => {
        const closestIdElem = closestElementWithId(el as HTMLElement);
        const uniqueId = generateUniqueIdentifier(
          el as HTMLElement,
          closestIdElem
        );
        el.setAttribute("i", uniqueId);
      });
    });
  } else {
    throw NO_GLOBAL_PAGE_ERROR;
  }
}

export async function getVisibleHtml(hiddenElementIds: string[]) {
  if (globalPage) {
    let visibleHtml = await globalPage.evaluate((hiddenElementIds) => {
      const clonedBody = document.body.cloneNode(true) as HTMLElement;
      hiddenElementIds.forEach((id) => {
        const el = clonedBody.querySelector(`[i="${id}"]`);
        el?.parentNode?.removeChild(el);
      });
      return clonedBody.innerHTML;
    }, hiddenElementIds);

    visibleHtml = await minify(visibleHtml, {
      collapseWhitespace: true,
      removeComments: true,
    });

    return visibleHtml;
  }
  throw NO_GLOBAL_PAGE_ERROR;
}

async function readScreen(rawHtml: string | undefined, actionId: string) {
  if (!rawHtml) {
    throw Error("no html on readScreen");
  }
  const { html: htmlWithI } = simplifyHtml(rawHtml, false);
  const { html: htmlWithoutI } = simplifyHtml(rawHtml, true);

  const screenDescription = await getScreenDescription(htmlWithoutI);

  const screen = await prisma.screen.create({
    data: {
      url: globalPage ? globalPage.url() : "",
      rawHtml: rawHtml,
      simpleHtml: htmlWithI,
      prevActionId: actionId,
      description: screenDescription,
    },
    select: {
      id: true,
    },
  });

  const processComponentData = async (
    components: ActionComponent[]
  ): Promise<Prisma.ComponentCreateInput[]> => {
    const componentInfos = await Promise.all(
      components.map(async (comp) => {
        const info = await getComponentInfo({
          componentHtml: removeAttributeI(comp.html),
          pageDescription: screenDescription,
        });
        return {
          i: comp.i,
          html: comp.html,
          type: comp.type,
          description: info?.description || "",
          actionType: info?.action.type || "",
        };
      })
    );

    return componentInfos;
  };
  const actionComponents = extractActionComponents(htmlWithI);
  const componentData = await processComponentData(actionComponents);

  await prisma.component.createMany({
    data: componentData,
  });

  const chats = await prisma.chat.findMany({
    select: {
      id: true,
      createdAt: true,
      role: true,
      content: true,
      description: true,
    },
  });

  const objective = await getUserObjective(chats);

  const taskOrder = await getTaskOrder({
    components: componentData,
    objective,
    pageDescription: screenDescription,
  });

  taskOrder.forEach(async (i) => {
    const result = await getInteractionOrQuestion({
      component: componentData[i],
      chats,
    });
    if (isSuggestedInteraction(result)) {
      if (result.suggestedInteraction.type === "click") {
        await click({ i: result.suggestedInteraction.elementI });
      }
      if (result.suggestedInteraction.type === "input") {
        await inputText({
          i: result.suggestedInteraction.elementI,
          value: result.suggestedInteraction.value,
        });
      }
    }
  });
}

async function createAction(
  type: Interaction,
  value?: string,
  componentId?: string
) {
  return await prisma.action.create({
    data: {
      type,
      value,
      onComponent: componentId ? { connect: { id: componentId } } : undefined,
    },
  });
}

export async function navigate(input: NavigateInput) {
  try {
    globalBrowser = await puppeteer.launch({ headless: false });
    globalPage = await globalBrowser.newPage();
    await globalPage.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );
    await globalPage.setViewport({ width: 390, height: 844 });
    await globalPage.goto(input.url, {
      waitUntil: "networkidle0",
    });

    await addUniqueIAttribute();

    const navigateAction = await createAction("GOTO", input.url);
    const hiddenElementIs = await getHiddenElementIs(globalPage);
    const visibleHtml = await getVisibleHtml(hiddenElementIs);
    const screenResult = await readScreen(visibleHtml, navigateAction.id);

    return screenResult;
  } catch (error: any) {
    console.error("Failed to navigate to the webpage.", error);
    throw error;
  }
}

export async function click(input: ClickInput) {
  try {
    const component = await prisma.component.findFirst({
      where: {
        i: input.i,
      },
    });
    const clickAction = await createAction("CLICK", "", component?.id);

    await addUniqueIAttribute();

    const preActionAllElementIs = await getAllElementIs(globalPage);
    const preActionHiddenElementIs = await getHiddenElementIs(globalPage);

    const preActionHTML = await getContentHTML(globalPage);
    const preActionURL = globalPage?.url();

    if (globalPage) {
      // const navigationPromise = globalPage.waitForNavigation({
      //   timeout: 500,
      //   waitUntil: "networkidle0",
      // });

      await globalPage.evaluate((i) => {
        const element = document.querySelector(`[i="${i}"]`) as HTMLElement;
        if (element) {
          (element as HTMLElement).click();
        }
      }, input.i);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // try {
      //   await navigationPromise;
      // } catch (e) {
      //   console.log("No navigation");

      // }
    }

    await addUniqueIAttribute();

    const postActionAllElementIs = await getAllElementIs(globalPage);
    const postActionHiddenElementIs = await getHiddenElementIs(globalPage);
    const postActionHTML = await getContentHTML(globalPage);
    const postActionURL = globalPage?.url();

    if (preActionURL === postActionURL) {
      const { appearedElement, vanishedElement } = await detectChangedElements(
        preActionHTML,
        postActionHTML,
        preActionAllElementIs,
        postActionAllElementIs,
        preActionHiddenElementIs,
        postActionHiddenElementIs
      );

      if (appearedElement?.outerHTML) {
        console.log(simplifyHtml(appearedElement?.outerHTML).html);
      }
      if (appearedElement) {
        readScreen(appearedElement.outerHTML, clickAction.id);
      } else if (vanishedElement) {
        readScreen(postActionHTML, clickAction.id);
      } else {
        readScreen(postActionHTML, clickAction.id);
      }
    } else {
      readScreen(postActionHTML, clickAction.id);
    }
  } catch (error: any) {
    console.error("Failed to click on the webpage.", error);
    throw error;
  }
}

export async function inputText(input: TextInput) {
  const { i, value } = input;
  try {
    if (globalPage) {
      await globalPage.evaluate(
        ({ i, value }) => {
          const element = document.querySelector(`[i="${i}"]`);
          if (element && element.tagName.toLowerCase() === "input") {
            (element as HTMLInputElement).value = value || "";
          }
        },
        { i, value }
      );
      const inputAction = await createAction("INPUT", `${i}:${value}`);
    }
  } catch (error: any) {
    console.error("Failed to input text on the webpage.", error);
    throw error;
  }
}

export async function scroll(input: ScrollInput) {
  try {
    if (globalPage) {
      const { x, y, width, height } = await globalPage.evaluate((i) => {
        const rect = document
          .querySelector(`[i="${i}"]`)
          ?.getBoundingClientRect();
        if (rect) {
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        } else {
          throw Error("Cannot find rect for scrolling");
        }
      }, input.i);

      await globalPage.mouse.move(x + width / 2, y + height / 2);

      let previousInnerHtml;
      let newInnerHtml = await globalPage.evaluate(
        (i) => document.querySelector(`[i="${i}"]`)?.innerHTML,
        input.i
      );

      while (previousInnerHtml !== newInnerHtml) {
        await globalPage.mouse.wheel({ deltaY: 100 });
        previousInnerHtml = newInnerHtml;
        newInnerHtml = await globalPage.evaluate(
          (i) => document.querySelector(`[i="${i}"]`)?.innerHTML,
          input.i
        );
      }

      const scrollAction = await createAction("SCROLL", input.i);
    }
  } catch (error: any) {
    console.error("Failed to scroll the element.", error);
    return error;
  }
}

export async function hover(input: HoverInput) {
  try {
    if (globalPage) {
      const { x, y, width, height } = await globalPage.evaluate((i) => {
        const rect = document
          .querySelector(`[i="${i}"]`)
          ?.getBoundingClientRect();
        if (rect) {
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        } else {
          throw Error("Cannot find rect for scrolling");
        }
      }, input.i);

      // Move mouse to the center of the element
      await globalPage.mouse.move(x + width / 2, y + height / 2);

      const hoverAction = await createAction("HOVER", input.i);

      // Set maximum wait time to 2 seconds
      const maxWaitTime = 2000;
      let newInnerHTML;
      let previousInnerHTML = await globalPage.evaluate(
        (i) => document.querySelector(`[i="${i}"]`)?.innerHTML,
        input.i
      );

      // Wait for change in innerHTML or timeout
      const changeDetected = new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          newInnerHTML = await globalPage!.evaluate(
            (i) => document.querySelector(`[i="${i}"]`)?.innerHTML,
            input.i
          );
          if (newInnerHTML !== previousInnerHTML) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 500);
      });

      const timeout = new Promise((resolve) =>
        setTimeout(() => resolve(false), maxWaitTime)
      );

      const result = await Promise.race([changeDetected, timeout]);
    }
  } catch (error) {
    console.error("Failed to hover the element.", error);
    return error;
  }
}

export async function goBack() {
  try {
    if (globalPage) {
      await globalPage.goBack();

      const backAction = await createAction("BACK");
    } else {
      throw new Error("Cannot go back, globalPage is not defined");
    }
  } catch (error) {
    console.error("Failed to go back.", error);
    return error;
  }
}
