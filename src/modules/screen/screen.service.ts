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
  extractFeatureComponents,
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
import {
    getPossibleInteractionDescription
} from "../../utils/langchainHandler";
import {
  ComponentInfo,
  getComponentFeature,
  getComponentInfo,
  getInteractionOrQuestion,
  getScreenDescription,
  getTaskOrder,
  getUserObjective,
  isSuggestedInteraction,
} from "../../utils/langchainHandler";
import { addIAttribute, getHiddenElementIs } from "../../utils/pageHandler";

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

export interface parsingResult{
    i: string;
    action: string;
    description: string;
    html: string;
}

export async function parsingAgent(rawHtml: string | undefined, screenDescription: string) : Promise<parsingResult[]>{
    if (!rawHtml) {
      throw Error("no html");
    }
    const possibleInteractions = parsingPossibleInteraction(rawHtml);
    const possibleInteractionsInString = JSON.stringify(possibleInteractions, null, 0);
    const res = await getPossibleInteractionDescription(rawHtml, possibleInteractionsInString, screenDescription);
    const actionComponentsList = JSON.parse(res);
    const dom = new JSDOM(rawHtml);
    const body = dom.window.document.body;
    const actionComponents = actionComponentsList.map((actionComponent: any) => {
        return {
            i: actionComponent.element,
            action: actionComponent.actionType,
            description: actionComponent.description,
            html: body.querySelector(`[i="${actionComponent.element}"]`)?.outerHTML
        }
    })
    return actionComponents;
}

  const processComponentData = async (components: FeatureComponent[]) => {
    const componentInfos = await Promise.all(
      components.map(async (comp) => {
        const feature = await getComponentFeature(
          removeAttributeI(comp.html),
          screenDescription
        );
        return {
          i: comp.i,
          html: comp.html,
          feature,
        };
      })
    );

    return componentInfos;
  };
  const featureComponents = extractFeatureComponents(htmlWithI);
  const components = await processComponentData(featureComponents);

  return components;
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

    await addIAttribute(globalPage);

    const navigateAction = await createAction("GOTO", input.url);
    const hiddenElementIs = await getHiddenElementIs(globalPage);
    const visibleHtml = await getVisibleHtml(hiddenElementIs);
    const screenResult = await parsingAgent(visibleHtml, navigateAction.id);

    return screenResult;
  } catch (error: any) {
    console.error("Failed to navigate to the webpage.", error);
    throw error;
  }
}
