import { Interaction } from "@prisma/client";
import { minify } from "html-minifier-terser";
import { Browser, Page } from "puppeteer";
import { PossibleInteractions } from "../../utils/htmlHandler";
import { PageHandler } from "../../utils/pageHandler";
import prisma from "../../utils/prisma";
import { executionAgent, planningAgent } from "../agents";
import { createHumanChat, getChats, createAIChat } from "../chat/chat.service";
import { NavigateInput } from "./screen.schema";
import { SystemLog, getSystemContext } from "../../prompts/actionPrompts";
import { getUserObjective, getUserContext } from "../../prompts/chatPrompts";

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
  createAIChat({ content: "How can I help you?" });
  createHumanChat({ content: "I want to book a ticket." });
  try {
    let page = await new PageHandler();
    await page.initialize();

    const prevAction = await createAction("GOTO", input.url);

    let focusSection = await page.navigate(input.url); // Current focused section. Can be a page, a modal or a section.
    let actionLogs: SystemLog[] = []; // List of actions that have been executed
    actionLogs.push({
      id: focusSection.id,
      type: focusSection.type,
      screenDescription: focusSection.screenDescription,
      actionDescription: `Navigate to the page: ${focusSection.screenDescription}`,
    });
    while (true) {
      //   const simpleHtml = await simplifyHtml(focusSection.html, false);
      //   const screenDescription = await getScreenDescription(simpleHtml);
      //   const parsingResult = await parsingAgent(simpleHtml, screenDescription);

      const chats = await getChats();
      const [userObjective, userContext] = await Promise.all([
        getUserObjective(chats),
        getUserContext(chats),
      ]);

      //   const systemContext = await getSystemContext(); // TODO: get system context
      //   await planningAgent(parsingResult, userObjective, userContext, systemContext);
      const actionComponents = focusSection.actionComponents;

      const systemContext = await getSystemContext(actionLogs);
      // Get task list
      const taskList = await planningAgent(
        focusSection,
        userContext,
        systemContext
      );

      // Get first task
      const task = taskList[0];
      if (task) {
        focusSection = await executionAgent(
          page,
          actionComponents.find((item) => item.i === task.i)!,
          focusSection.screenDescription,
          focusSection,
          actionLogs
        );
      } else {
        // TODO: Haven't tested unfocus yet
        if (focusSection.type === "section") {
          page.unfocus();
          continue;
        }
        break;
      }
    }
  } catch (error: any) {
    console.error("Failed to navigate to the webpage.", error);
    throw error;
  }
}
