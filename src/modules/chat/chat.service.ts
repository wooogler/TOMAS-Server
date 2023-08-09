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
  return prisma.chat.findMany();
}

export async function navigate(
  input: NavigateInput
): Promise<navigateResponse> {
  try {
    await page.initialize();
    focusSection = await page.navigate(input.url);
    actionLogs.push({
      id: focusSection.id,
      type: focusSection.type,
      screenDescription: focusSection.screenDescription,
      actionDescription: `Navigate to the page`,
    });
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

export async function firstOrder(
  input: CreateHumanChatInput
): Promise<AnswerResponse> {
  createHumanChat(input);
  const response = await planningAndAsk();
  if (response) {
    return response;
  } else {
    throw new Error("Failed to get the response from the planning agent.");
  }
}

async function planningAndAsk(): Promise<AnswerResponse | undefined> {
  try {
    const chats = await getChats();
    const userContext = await getUserContext(chats);
    const actionComponents = focusSection.actionComponents;

    const systemContext = await getSystemContext(actionLogs);
    const taskList = await planningAgent(
      "",
      focusSection,
      userContext,
      systemContext
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
              actionValue
            );
            await createAIChat({ content: confirmationQuestion });
            return { component, type: "requestConfirmation", actionValue };
          }
        } else if (component.actionType === "select") {
          const options = await page.select(`['i="${component.i}"]`);
          await createAIChat({
            content: `Which one do you want?

Possible options could be:
${options.actionComponents.map(
  (action) => `- ${action.description} (i=${action.i}))`
)}`,
          });
          return { component, type: "questionForSelect" };
        } else {
          const confirmationQuestion = await makeQuestionForConfirmation(
            component,
            ""
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
  createHumanChat(input);
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
      const question = await makeQuestionForActionValue(
        screenDescription,
        component.description
      );
      await createAIChat({ content: question });
      return { component, type: "questionForInput" };
    } else {
      const confirmationQuestion = await makeQuestionForConfirmation(
        component,
        actionValue
      );
      await createAIChat({ content: confirmationQuestion });
      return { component, type: "requestConfirmation" };
    }
  } else {
    throw new Error("No Component!");
  }
}

export async function answerForSelect(input: AnswerInput) {
  createHumanChat(input);
  const component = input.component;
  const options = await page.select(`['i="${component.i}"]`);
  const selectedItem = options.actionComponents[parseInt(input.content) - 1];
  if (selectedItem) {
    const confirmationQuestion = await makeQuestionForConfirmation(
      component,
      selectedItem.description || ""
    );
    await createAIChat({ content: confirmationQuestion });
    return {
      component,
      type: "requestConfirmation",
      actionValue: selectedItem.i + "---" + selectedItem.description,
    };
  }
}

export async function confirm(
  input: ConfirmInput
): Promise<AnswerResponse | undefined> {
  createHumanChat(input);
  const component = input.component;
  if (input.content === "yes") {
    if (component) {
      if (component.actionType === "input") {
        if (!input.actionValue) {
          throw new Error("No action value for input");
        }
        focusSection = await page.inputText(
          `[i=${component.i}]`,
          input.actionValue
        );
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
      } else if (component.actionType === "click") {
        focusSection = await page.click(`[i="${component.i}"]`);
        const actionDescription = await getActionHistory(component, "yes");
        actionLogs.push({
          type: focusSection.type,
          id: focusSection.id,
          screenDescription: focusSection.screenDescription,
          actionDescription,
        });
      } else if (component.actionType === "select") {
        if (!input.actionValue) {
          throw new Error("No action value for select");
        }
        const selected = input.actionValue.split("---");
        const iAttr = selected[0];
        const description = selected[1];
        focusSection = await page.focus(`[i="${iAttr}"]`);
        const actionDescription = await getActionHistory(
          component,
          description
        );
        actionLogs.push({
          type: focusSection.type,
          id: focusSection.id,
          screenDescription: focusSection.screenDescription,
          actionDescription,
        });
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
