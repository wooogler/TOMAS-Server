import puppeteer, { Browser, Page } from "puppeteer";
import {
  NavigateInput,
  ClickInput,
  HoverInput,
  ScrollInput,
  TextInput,
} from "./screen.schema";
import { simplifyHtml } from "../../utils/htmlHandler";
import prisma from "../../utils/prisma";
import { Component, Interaction, Prisma } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PrismaVectorStore } from "langchain/vectorstores/prisma";
import { HumanChatMessage } from "langchain/schema";
import { minify } from "html-minifier-terser";

import { JSDOM } from "jsdom";
import {
  describeActionComponentPrompts,
  makePromptMessages,
} from "../../utils/prompts";

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

const NO_GLOBAL_PAGE_ERROR = new Error("Cannot find globalPage.");

const chat = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-16k",
  temperature: 0,
});

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

async function modifyDom() {
  if (globalPage) {
    const hiddenElementIds = await globalPage.evaluate(() => {
      let idCounter = 0;
      const elements = document.querySelectorAll("*");
      const hiddenElementIds: string[] = [];
      elements.forEach((el) => {
        el.setAttribute("i", String(idCounter));

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
          hiddenElementIds.push(String(idCounter));
        }

        idCounter++;
      });

      return hiddenElementIds;
    });
    let modifiedHtml = await globalPage.evaluate((hiddenElementIds) => {
      const clonedBody = document.body.cloneNode(true) as HTMLElement;
      hiddenElementIds.forEach((id) => {
        const el = clonedBody.querySelector(`[i="${id}"]`);
        el?.parentNode?.removeChild(el);
      });
      return clonedBody.innerHTML;
    }, hiddenElementIds);

    modifiedHtml = await minify(modifiedHtml, {
      removeAttributeQuotes: true,
      collapseWhitespace: true,
      removeComments: true,
    });

    return modifiedHtml;
  }
  throw NO_GLOBAL_PAGE_ERROR;
}

const removeAttributeI = (html: string) => {
  const dom = new JSDOM(html);
  const element = dom.window.document.body;
  element.querySelectorAll("*").forEach((node) => {
    if (node.hasAttribute("i")) {
      node.removeAttribute("i");
    }
  });
  return dom.serialize();
};

async function readScreen(rawHtml: string, actionId: string) {
  const { simpleHtml, actionComponents } = simplifyHtml(rawHtml);

  const actionComponentInfosPromises = actionComponents.map(async (comp) => {
    const promptsMessages = makePromptMessages(describeActionComponentPrompts);
    const newMessage = new HumanChatMessage(`Website HTML:
    ${removeAttributeI(simpleHtml)}
    
    The part of the website:
    ${removeAttributeI(comp.html)}`);

    const response = await chat.call([...promptsMessages, newMessage]);
    return { ...comp, description: response.text };
  });

  const screen = await prisma.screen.create({
    data: {
      url: globalPage ? globalPage.url() : "",
      rawHtml,
      simpleHtml,
      prevActionId: actionId,
    },
    select: {
      id: true,
    },
  });

  Promise.all(actionComponentInfosPromises)
    .then(async (actionComponentInfos) => {
      await vectorStore.addModels(
        await prisma.$transaction(
          actionComponentInfos.map((info) =>
            prisma.component.create({
              data: {
                type: info.type,
                description: info.description,
                i: info.i,
                html: info.html,
                screenId: screen.id,
              },
            })
          )
        )
      );
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  console.log(await vectorStore.similaritySearch(""));
}

async function createAction(type: Interaction, value?: string) {
  return await prisma.action.create({
    data: {
      type,
      value,
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

    const navigateAction = await createAction("GOTO", input.url);
    const rawHtml = await modifyDom();
    const screenResult = await readScreen(rawHtml, navigateAction.id);
    // await createComponents(
    //   screenResult.rawHtml,
    //   screenResult.simpleHtml,
    //   screenResult.id
    // );

    return screenResult;
  } catch (error: any) {
    console.error("Failed to navigate to the webpage.", error);
    throw error;
  }
}

export async function click(input: ClickInput) {
  try {
    if (globalPage) {
      await globalPage.evaluate((i) => {
        const element = document.querySelector(`[i="${i}"]`);
        if (element) {
          (element as HTMLElement).click();
        }
      }, input.i);
    }

    const clickAction = await createAction("CLICK", input.i);
    const rawHtml = await modifyDom();
    const screenResult = await readScreen(rawHtml, clickAction.id);
    return screenResult;
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
            (element as HTMLInputElement).value = value;
          }
        },
        { i, value }
      );
      const inputAction = await createAction("INPUT", `${i}:${value}`);
      const rawHtml = await modifyDom();
      const screenResult = await readScreen(rawHtml, inputAction.id);
      return screenResult;
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

      const rawHtml = await modifyDom();
      const screenResult = await readScreen(rawHtml, scrollAction.id);
      return screenResult;
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

      if (result) {
        const rawHtml = await modifyDom();
        const screenResult = await readScreen(rawHtml, hoverAction.id);
        return screenResult;
      } else {
        console.log("No change detected within the time limit.");
      }
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

      const rawHtml = await modifyDom();
      const screenResult = await readScreen(rawHtml, backAction.id);
      return screenResult;
    } else {
      throw new Error("Cannot go back, globalPage is not defined");
    }
  } catch (error) {
    console.error("Failed to go back.", error);
    return error;
  }
}
