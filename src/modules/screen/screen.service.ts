import puppeteer, { Browser, Page } from "puppeteer";
import {
  NavigateInput,
  ClickInput,
  HoverInput,
  ScrollInput,
  TextInput,
} from "./screen.schema";
import {
  FeatureComponent,
  PossibleInteractions,
  extractFeatureComponents,
  parsingPossibleInteraction,
  removeAttributeI,
  simplifyHtml,
} from "../../utils/htmlHandler";
import prisma from "../../utils/prisma";
import { Component, Interaction, Prisma } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PrismaVectorStore } from "langchain/vectorstores/prisma";
import { minify } from "html-minifier-terser";
import { JSDOM } from "jsdom";
import { getPossibleInteractionDescription } from "../../utils/langchainHandler";
import {
  ComponentInfo,
  getComponentFeature,
  getComponentInfo,
  getInteractionOrQuestion,
  getScreenDescription,
  getTaskOrder,
  getUserObjective,
  isSuggestedInteraction,
  getUserContext,
} from "../../utils/langchainHandler";
import {
  addIAttribute,
  getHiddenElementIs,
  PageHandler,
} from "../../utils/pageHandler";
import { getChats } from "../chat/chat.service";
import { planningAgent } from "../agents";

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

const NO_GLOBAL_PAGE_ERROR = new Error("Cannot find globalPage.");

// const vectorStore = PrismaVectorStore.withModel<Component>(prisma).create(
//   new OpenAIEmbeddings(),
//   {
//     prisma: Prisma,
//     tableName: "Component",
//     vectorColumnName: "vector",
//     columns: {
//       id: PrismaVectorStore.IdColumn,
//       description: PrismaVectorStore.ContentColumn,
//     },
//   }
// );

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

export interface ParsingResult {
  i: string;
  action: string;
  description: string;
  html: string;
}

function comparePossibleInteractions(
  a: PossibleInteractions,
  b: PossibleInteractions
) {
  if (parseInt(a.i) < parseInt(b.i)) {
    return -1;
  }
  if (parseInt(a.i) > parseInt(b.i)) {
    return 1;
  }
  return 0;
}
export async function parsingAgent(
  rawHtml: string | undefined,
  screenDescription: string
): Promise<ParsingResult[]> {
  if (!rawHtml) {
    throw Error("no html");
  }
  const possibleInteractions = parsingPossibleInteraction(rawHtml).sort(
    comparePossibleInteractions
  );

  const dom = new JSDOM(rawHtml);
  const body = dom.window.document.body;

  const actionComponents: {
    i: string;
    action: string;
    description: Promise<string>;
    html: string | undefined;
  }[] = possibleInteractions.map((interaction) => ({
    i: interaction.i,
    action: interaction.actionType,
    description: getPossibleInteractionDescription(
      rawHtml,
      JSON.stringify([interaction]),
      screenDescription
    ),
    html: body.querySelector(`[i="${interaction.i}"]`)?.outerHTML,
  }));
  const results: ParsingResult[] = [];
  for (const item of actionComponents) {
    const description: string = await item.description; // 等待 Promise 结果
    results.push({
      i: item.i,
      action: item.action,
      description,
      html: item.html!,
    });
  }
  return results;
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
    let page = await new PageHandler();
    await page.initialize();

    const prevAction = await createAction("GOTO", input.url);
    let navigateResult = await page.navigate(input.url);

    while (true) {
      const simpleHtml = await simplifyHtml(navigateResult.html, false);
      const screenDescription = await getScreenDescription(simpleHtml);
      const parsingResult = await parsingAgent(simpleHtml, screenDescription);
      const chats = await getChats();
      const [userObjective, userContext] = await Promise.all([
        getUserObjective(chats),
        getUserContext(chats),
      ]);

      //   const systemContext = await getSystemContext(); // TODO: get system context
      //   await planningAgent(parsingResult, userObjective, userContext, systemContext);

      // Get task list
      const taskList = await planningAgent(
        parsingResult,
        userObjective,
        userContext,
        ""
      );

      // Get first task
      const task = taskList[0];
      if (task) {
      }
    }

    // const pageName = await getPageName(removeAttributeI(simpleHtml));

    // return screenResult;
  } catch (error: any) {
    console.error("Failed to navigate to the webpage.", error);
    throw error;
  }
}
