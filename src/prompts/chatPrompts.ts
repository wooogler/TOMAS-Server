import { Chat } from "@prisma/client";
import { Prompt, getAiResponse } from "../utils/langchainHandler";
import { ActionComponent } from "../utils/pageHandler";
import { loadCacheFromFile, saveCacheToFile } from "../utils/fileUtil";
import { generateIdentifier } from "../utils/htmlHandler";
import { AnswerResponse } from "../modules/chat/chat.schema";
import { Action } from "../utils/parsingAgent";

export const makeConversationPrompt = (chats: Chat[]): Prompt => ({
  role: "HUMAN",
  content: `Conversation:
  ${chats
    .map(
      (chat) => `${chat.role === "HUMAN" ? "User" : "System"}: ${chat.content}`
    )
    .join("\n")}`,
});

export const getUserObjective = async (chats: Chat[]) => {
  const findTaskObjectiveSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You need to examine the conversation between user and system and determine the user's objective. Output the objective using "To ~" without providing additional context.`,
  };

  const conversationPrompt: Prompt = makeConversationPrompt(chats);

  return getAiResponse([findTaskObjectiveSystemPrompt, conversationPrompt]);
};

// 사용자의 목표를 추출하는 함수
export async function getUserGoal(chats: Chat[]): Promise<string> {
  const actionChats = chats;
  const conversationPrompt: Prompt = makeConversationPrompt(actionChats);

  const findUserGoalPrompt: Prompt = {
    role: "SYSTEM",
    content: `Based on the conversation between the system and the user, describe the user's goal.`,
  };

  const userGoalResponse = await getAiResponse([
    findUserGoalPrompt,
    conversationPrompt,
  ]);
  return userGoalResponse;
}

// 사용자 정보를 추출하는 함수
export async function getUserInfo(chats: Chat[]): Promise<string> {
  const actionChats = chats;
  const conversationPrompt: Prompt = makeConversationPrompt(actionChats);

  const findUserInfoPrompt: Prompt = {
    role: "SYSTEM",
    content: `Based on the conversation, extract any relevant user information and present it in a list format. Each item should be in the format "{key} : {value}"."`,
  };

  const userInfoResponse = await getAiResponse([
    findUserInfoPrompt,
    conversationPrompt,
  ]);
  console.log("userInfo: ", userInfoResponse);
  return userInfoResponse;
}

export async function makeQuestionForActionValue(
  screenDescription: string,
  componentDescription: string | undefined,
  componentHtml: string
) {
  const identifier = generateIdentifier(componentHtml);
  const questionCache = loadCacheFromFile("questionCache.json");
  const cachedQuestion = questionCache.get(identifier);
  if (cachedQuestion) {
    return cachedQuestion;
  }

  const makeQuestionPrompt: Prompt = {
    role: "SYSTEM",
    content: `Create a natural language question to ask to the user before doing the given action on the screen.

Action: ${componentDescription}

The description of the screen: ${screenDescription}
`,
  };

  const firstQuestionPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([makeQuestionPrompt]),
  };

  const modifyQuestionPrompt: Prompt = {
    role: "HUMAN",
    content:
      "The user does not see the screen and is unfamiliar with technology, so please do not mention the element and the action on the screen, and avoid the jargon, mechanical terms, and terms that are too specific to the webpage.",
  };

  const newQuestion = await getAiResponse([
    makeQuestionPrompt,
    firstQuestionPrompt,
    modifyQuestionPrompt,
  ]);

  questionCache.set(identifier, { question: newQuestion });
  saveCacheToFile(questionCache, "questionCache.json");

  return newQuestion;
}

export async function makeQuestionForConfirmation(
  action: Action,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompt: Prompt = {
    role: "SYSTEM",
    content: `Create a natural language question to ask whether the user wants to do the given action${
      action.type === "input" ? " with value" : ""
    }.

Action: ${action.content}
${action.type === "input" ? `Value: ${actionValue}` : ""}

The description of the screen: ${screenDescription}`,
  };

  const firstConfirmationPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([makeConfirmationPrompt]),
  };

  const modifyConfirmationPrompt: Prompt = {
    role: "HUMAN",
    content:
      "The user does not see the screen and is unfamiliar with technology, so please do not mention the element and the action on the screen, and avoid the jargon, mechanical terms, and terms that are too specific to the webpage.",
  };

  return await getAiResponse([
    makeConfirmationPrompt,
    firstConfirmationPrompt,
    modifyConfirmationPrompt,
  ]);
}

export async function makeQuestionForSelectConfirmation(
  componentDescription: string,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompt: Prompt = {
    role: "SYSTEM",
    content: `Create a natural language question to ask whether the user wants to do the given action with value

Action: Select ${componentDescription}
Value: ${actionValue}

The description of the screen: ${screenDescription}`,
  };

  const firstConfirmationPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([makeConfirmationPrompt]),
  };

  const modifyConfirmationPrompt: Prompt = {
    role: "HUMAN",
    content:
      "The user does not see the screen and is unfamiliar with technology, so please do not mention the element and the action on the screen, and avoid the jargon, mechanical terms, and terms that are too specific to the webpage.",
  };

  return await getAiResponse([
    makeConfirmationPrompt,
    firstConfirmationPrompt,
    modifyConfirmationPrompt,
  ]);
}

export const makeSelectQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Based on the 'select' action described in the input, create a Korean question that asks the user which item they wish to choose from a specific list. The question should directly inquire about the user's choice regarding the item to be selected from the list. Avoid including any English translation in the output.",
});

export const makeInputQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given the 'input' action described, generate a Korean directive asking the user to input the specified information. The directive should clearly prompt the user to enter the information related to the input action. Avoid providing any English translation in the output.",
});

export const makeClickQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given the 'click' action described in the input, create a Korean question that asks the user whether they wish to proceed with the click action. The question should directly inquire about the user's intention to perform the specific click action mentioned. Refrain from including any English translation in the output.",
});

export const makeElementDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Generate a Korean description of the specific element on a webpage. Emphasize the immediate outcome or effect of this interaction, focusing on the functionality of the action. Avoid going into details about the nature, representation, or location of the element itself. The description should be clear, concise, and directly related to the user's interaction with the element.",
});

export const makeListDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Generate a Korean description of the specific list on a webpage. Emphasize the immediate outcome or effect of selecting an item from this list, focusing on the functionality of the action. Avoid going into details about the nature or representation of the list itself or its location on the webpage. The description should be clear, concise, and directly related to what happens when a user interacts with the list by selecting an item.",
});

export const makeSectionDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Generate a Korean description explaining the action preformed by seeing the section on a webpage. Focus on describing the function without detailing what the section represents or where it is located.",
});

export const translateQuestionTemplate = (): Prompt => ({
  role: "HUMAN",
  content: "Translate the question into Korean.",
});
