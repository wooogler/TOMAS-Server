import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import prisma from "../../utils/prisma";
import {
  AnswerInput,
  AnswerResponse,
  ConfirmInput,
  CreateHumanChatInput,
  NavigateInput,
  SelectInput,
  SelectResponse,
  navigateResponse,
} from "./chat.schema";
import {
  ActionComponent,
  PageHandler,
  ScreenResult,
} from "../../utils/pageHandler";
import {
  SystemLog,
  findInputTextValue,
  getActionHistory,
  getSystemContext,
  getUserContext,
  makeQuestionForActionValue,
  makeQuestionForConfirmation,
  getUsefulAttrFromList,
  getListFromSelectResult,
  getDataFromHTML,
  makeQuestionForSelectConfirmation,
} from "../../utils/langchainHandler";
import { planningAgent } from "../agents";
import { ActionType } from "../../utils/htmlHandler";

const page = new PageHandler();
let focusSection: ScreenResult;
let actionLogs: SystemLog[] = [];

export async function createHumanChat(input: CreateHumanChatInput) {
  await prisma.chat.create({
    data: {
      role: "HUMAN",
      content: input.content,
    },
  });
}

export async function createAIChat(input: CreateHumanChatInput) {
  await prisma.chat.create({
    data: {
      role: "AI",
      content: input.content,
    },
  });
}

export function getChats() {
  return prisma.chat.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });
}

export function getNewestChat() {
  return prisma.chat.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function navigate(
  input: NavigateInput
): Promise<navigateResponse> {
  try {
    await page.initialize();
    focusSection = await page.navigate(input.url);
    createAIChat({ content: "How can I help you?" });
    return {
      screenDescription: focusSection.screenDescription,
      type: "navigate",
    };
  } catch (error: any) {
    console.error("Failed to navigate to the webpage.", error);
    throw error;
  }
}

export async function convertSelectResultIntoTable(
  actionComponents: ActionComponent[],
  screenDescription: string
): Promise<
  ({ i: string; description: string } & Record<string, string | string[]>)[]
> {
  const attrList = await getUsefulAttrFromList(
    actionComponents,
    screenDescription
  );

  try {
    const jsList = await Promise.all(
      actionComponents.map((comp) =>
        getListFromSelectResult(comp, screenDescription, attrList)
      )
    );

    return jsList.filter(Boolean) as ({
      i: string;
      description: string;
    } & Record<string, string | string[]>)[];
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function firstOrder(
  input: CreateHumanChatInput
): Promise<AnswerResponse | SelectResponse> {
  console.log("firstOrder");
  await createHumanChat(input);
  const response = await planningAndAsk();
  if (response) {
    return response;
  } else {
    throw new Error("Failed to get the response from the planning agent.");
  }
}

async function planningAndAsk(): Promise<
  AnswerResponse | SelectResponse | undefined
> {
  console.log("planningAndAsk");
  try {
    const chats = await getChats();
    const userContext = await getUserContext(chats);
    const actionComponents = focusSection.actionComponents;

    const systemContext = await getSystemContext(actionLogs);
    const taskList = await planningAgent(
      focusSection,
      userContext,
      actionLogs.length !== 0 ? systemContext : "No action history"
    );

    const task = taskList[0];
    if (task) {
      const component = actionComponents.find((item) => item.i === task.i);
      const screenDescription = focusSection.screenDescription;
      if (component) {
        if (component.actionType === "input") {
          let valueBasedOnHistory = await JSON.parse(
            await findInputTextValue(
              screenDescription,
              component.description,
              userContext
            )
          );

          const actionValue = valueBasedOnHistory.value;
          // If user context is not enough to answer the question
          if (actionValue === null) {
            const question = await makeQuestionForActionValue(
              screenDescription,
              component.description
            );
            await createAIChat({ content: question });
            return { component, type: "questionForInput" };
          } else {
            const confirmationQuestion = await makeQuestionForConfirmation(
              component,
              screenDescription,
              actionValue
            );
            await createAIChat({ content: confirmationQuestion });
            return { component, type: "requestConfirmation", actionValue };
          }
        } else if (component.actionType === "select") {
          const question = await makeQuestionForActionValue(
            screenDescription,
            component.description
          );
          const options = await page.select(`[i="${component.i}"]`);
          await createAIChat({
            content: `${question}`,
          });
          return {
            components: await getDataFromHTML(options),
            type: `questionForSelect`,
          };
        } else {
          const confirmationQuestion = await makeQuestionForConfirmation(
            component,
            screenDescription
          );
          await createAIChat({ content: confirmationQuestion });
          return { component, type: "requestConfirmation" };
        }
      }
    } else {
      console.log("no task");
      focusSection = await page.unfocus();
      return await planningAndAsk();
    }
  } catch (error) {
    throw new Error(error as any);
  }
}

export async function answerForInput(
  input: AnswerInput
): Promise<AnswerResponse> {
  console.log("answerForInput");
  await createHumanChat(input);
  const chats = await getChats();
  const userContext = await getUserContext(chats);
  const screenDescription = focusSection.screenDescription;
  const component = input.component;

  if (component) {
    let valueBasedOnHistory = await JSON.parse(
      await findInputTextValue(
        screenDescription,
        component?.description,
        userContext
      )
    );

    const actionValue = valueBasedOnHistory.value;
    // If user context is not enough to answer the question
    if (actionValue === null) {
      console.log("actionValue is null");
      const question = await makeQuestionForActionValue(
        screenDescription,
        component.description
      );
      await createAIChat({ content: question });
      return { component, type: "questionForInput" };
    } else {
      console.log("actionValue is " + actionValue);
      const confirmationQuestion = await makeQuestionForConfirmation(
        component,
        screenDescription,
        actionValue
      );
      await createAIChat({ content: confirmationQuestion });
      return { component, type: "requestConfirmation", actionValue };
    }
  } else {
    throw new Error("No Component!");
  }
}

export async function answerForSelect(
  input: SelectInput
): Promise<AnswerResponse> {
  console.log("answerForSelect");
  await createHumanChat({
    ...input,
    content: input.content,
  });
  const component = input.component;
  const screenDescription = focusSection.screenDescription;
  const confirmationQuestion = await makeQuestionForSelectConfirmation(
    component.description || "",
    screenDescription,
    input.content
  );
  await createAIChat({ content: confirmationQuestion });
  return {
    component: {
      i: component.i,
      description: component.description,
      html: "",
      actionType: typeof component.data === "string" ? "click" : "focus",
    },
    type: "requestConfirmation",
    actionValue: component.i + "---" + component.description,
  };
}

export async function confirm(
  input: ConfirmInput
): Promise<AnswerResponse | SelectResponse | undefined> {
  console.log("confirm");
  await createHumanChat(input);
  const component = input.component;
  if (input.content === "yes") {
    if (component) {
      if (component.actionType === "input") {
        if (!input.actionValue) {
          throw new Error("No action value for input");
        }
        const actionDescription = await getActionHistory(
          component,
          input.actionValue
        );
        actionLogs.push({
          type: focusSection.type,
          id: focusSection.id,
          screenDescription: focusSection.screenDescription,
          actionDescription,
        });
        focusSection = await page.inputText(
          `[i="${component.i}"]`,
          input.actionValue
        );
      } else if (component.actionType === "click") {
        console.log("confirm for click");
        const actionDescription = await getActionHistory(component, "yes");
        actionLogs.push({
          type: focusSection.type,
          id: focusSection.id,
          screenDescription: focusSection.screenDescription,
          actionDescription,
        });
        focusSection = await page.click(`[i="${component.i}"]`);
      } else if (component.actionType === "select") {
        if (!input.actionValue) {
          throw new Error("No action value for select");
        }
        console.log("confirm for select");
        const selected = input.actionValue.split("---");
        const iAttr = selected[0];
        const description = selected[1];
        // const actionDescription = await getActionHistory(
        //   component,
        //   description
        // );
        // actionLogs.push({
        //   type: focusSection.type,
        //   id: focusSection.id,
        //   screenDescription: focusSection.screenDescription,
        //   actionDescription,
        // });
        focusSection = await page.select(`[i="${iAttr}"]`);
      } else if (component.actionType === "focus") {
        if (!input.actionValue) {
          throw new Error("No action value for select");
        }
        console.log("confirm for focus");
        const selected = input.actionValue.split("---");
        const iAttr = selected[0];
        const description = selected[1];
        focusSection = await page.select(`[i="${iAttr}"]`, true);
      }
    }
  } else {
    const actionDescription = await getActionHistory(
      component,
      "Action Failed"
    );
    actionLogs.push({
      type: focusSection.type,
      id: focusSection.id,
      screenDescription: focusSection.screenDescription,
      actionDescription,
    });
  }
  return await planningAndAsk();
}

export async function deleteChats() {
  await prisma.chat.deleteMany();
}

export async function closePage() {
  await page.close();
}

export function deleteLogs() {
  actionLogs = [];
}
