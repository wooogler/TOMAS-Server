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
import { planningAgent } from "../agents";
import { ActionType } from "../../utils/htmlHandler";
import {
  SystemLog,
  getSystemContext,
  findInputTextValue,
  getActionHistory,
} from "../../prompts/actionPrompts";
import {
  getUserContext,
  makeQuestionForConfirmation,
  makeQuestionForSelectConfirmation,
} from "../../prompts/chatPrompts";
import {
  getUsefulAttrFromList,
  getListFromSelectResult,
  getDataFromHTML,
} from "../../prompts/visualPrompts";
import {
  loadObjectArrayFromFile,
  saveObjectArrayToFile,
} from "../../utils/fileUtil";
import { Action } from "../../utils/parsingAgent";

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
    createAIChat({ content: "어떻게 도와드릴까요? " });
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
    actionLogs = loadObjectArrayFromFile<SystemLog>("actionLogs.json");

    const chats = await getChats();
    const userContext = await getUserContext(chats);
    const actions = focusSection.actions;

    const systemContext = await getSystemContext(actionLogs);
    const taskList = await planningAgent(
      focusSection,
      userContext,
      actionLogs.length !== 0 ? systemContext : "No action history"
    );

    const task = taskList[0];
    if (task) {
      page.highlight(`[i="${task.i}"]`);
      const action = actions.find((item) => item.i === Number(task.i));
      const screenDescription = focusSection.screenDescription;
      if (action) {
        const component: AnswerResponse["component"] = {
          i: action.i.toString(),
          description: action.content,
          html: action.html,
          actionType: action.type,
          question: action.question || "No Question",
        };

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
          if (actionValue === null || actionValue === "") {
            const question = action.question;
            await createAIChat({ content: question || "No Question" });
            return { component, type: "questionForInput" };
          } else {
            const confirmationQuestion = await makeQuestionForConfirmation(
              action,
              screenDescription,
              actionValue
            );
            await createAIChat({ content: confirmationQuestion });
            return { component, type: "requestConfirmation", actionValue };
          }
        } else if (component.actionType === "select") {
          const question = action.question;
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
            action,
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
  if (page) {
    page.removeHighlight();
  }
  await createHumanChat(input);
  const chats = await getChats();
  const userContext = await getUserContext(chats);
  const screenDescription = focusSection.screenDescription;
  const component = input.component;
  const action: Action = {
    type: component.actionType,
    content: component.description || "",
    html: component.html,
    i: Number(component.i),
    question: component.question,
  };

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
      const question = action.question;
      await createAIChat({ content: question || "No Question" });
      return { component, type: "questionForInput" };
    } else {
      console.log("actionValue is " + actionValue);
      const confirmationQuestion = await makeQuestionForConfirmation(
        action,
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
  if (page) {
    page.removeHighlight();
  }
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
  page.highlight(`[i="${component.i}"]`);
  return {
    component: {
      i: component.i,
      description: component.description,
      html: "",
      actionType: component.actionType as ActionType,
    },
    type: "requestConfirmation",
    actionValue: component.i + "---" + component.description,
  };
}

export async function confirm(
  input: ConfirmInput
): Promise<AnswerResponse | SelectResponse | undefined> {
  console.log("confirm");
  if (page) {
    page.removeHighlight();
  }
  await createHumanChat(input);
  const component = input.component;
  const action: Action = {
    type: component.actionType,
    content: component.description || "",
    html: component.html,
    i: Number(component.i),
  };
  if (input.content === "yes") {
    if (component) {
      if (component.actionType === "input") {
        if (!input.actionValue) {
          throw new Error("No action value for input");
        }
        const actionDescription = await getActionHistory(
          action,
          input.actionValue
        );
        actionLogs.push({
          type: focusSection.type,
          id: focusSection.id,
          screenDescription: focusSection.screenDescription,
          actionDescription,
        });
        // saveObjectArrayToFile(actionLogs, "actionLogs.json");
        focusSection = await page.inputText(
          `[i="${component.i}"]`,
          input.actionValue
        );
      } else if (component.actionType === "click") {
        console.log("confirm for click");
        const actionDescription = await getActionHistory(action, "yes");
        actionLogs.push({
          type: focusSection.type,
          id: focusSection.id,
          screenDescription: focusSection.screenDescription,
          actionDescription,
        });
        saveObjectArrayToFile(actionLogs, "actionLogs.json");
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
    const actionDescription = await getActionHistory(action, "Action Failed");
    actionLogs.push({
      type: focusSection.type,
      id: focusSection.id,
      screenDescription: focusSection.screenDescription,
      actionDescription,
    });
    saveObjectArrayToFile(actionLogs, "actionLogs.json");
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
