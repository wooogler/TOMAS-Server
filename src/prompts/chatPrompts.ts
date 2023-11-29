import { Chat } from "@prisma/client";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { ActionComponent } from "../utils/pageHandler";
import {
  loadCacheFromFile,
  loadJsonFromFile,
  saveCacheToFile,
} from "../utils/fileUtil";
import { generateIdentifier } from "../utils/htmlHandler";
import { AnswerResponse } from "../modules/chat/chat.schema";
import { Action } from "../utils/parsingAgent";

export const makeConversation = (chats: Chat[]): string => {
  const actionChats = chats.filter((chat) => !chat.type.startsWith("confirm"));

  // "선택 안함" 응답의 인덱스 찾기
  const selectedIndex = actionChats.findIndex(
    (chat) => chat.content === "선택 안함"
  );

  // "선택 안함"이 있다면 해당 응답과 그 이전 질문 제거
  if (selectedIndex !== -1) {
    actionChats.splice(selectedIndex - 1, 2);
  }

  return actionChats
    .map(
      (chat) => `${chat.role === "HUMAN" ? "User" : "System"}: ${chat.content}`
    )
    .join("\n");
};

// 사용자의 목표를 추출하는 함수
export async function getUserContext(chats: Chat[]): Promise<string> {
  const conversation: string = makeConversation(chats);

  const findUserGoalPrompt: Prompt = {
    role: "SYSTEM",
    content: `Based on the conversation between the system and the user, describe the user's goal.
    
Conversation:
${conversation}
    `,
  };

  const userGoalResponse = await getAiResponse([findUserGoalPrompt]);
  console.log(findUserGoalPrompt.content);
  console.log(userGoalResponse);
  return userGoalResponse;
}

// 사용자 정보를 추출하는 함수
export async function getUserInfo(
  chats: Chat[],
  userContext: string
): Promise<object> {
  const conversation: string = makeConversation(chats);

  const defaultUserInfo = loadJsonFromFile("userInfo.json");

  const findUserInfoPrompt: Prompt = {
    role: "SYSTEM",
    content: `Based on the conversation and user's context, output any relevant information in a one-level JSON format.

Conversation: 
${conversation}

User's context: ${userContext}
`,
  };

  const userInfoResponse = await getGpt4Response([findUserInfoPrompt]);
  const jsonRegex = /{.*?}/s;
  const userInfoJson = userInfoResponse.match(jsonRegex);
  if (userInfoJson) {
    const userInfo = JSON.parse(userInfoJson[0]);
    return { ...defaultUserInfo, ...userInfo };
  }

  return { ...defaultUserInfo };
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

export async function makeQuestionForInputConfirmation(
  action: Action,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the input action on the screen, Create a Korean natural language question to ask whether the user wants to input the value or not.

Input action: ${action.content}
Value: ${actionValue}

The description of the screen: ${screenDescription}`,
  };

  return await getAiResponse([makeConfirmationPrompt]);
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
    "Given the 'select' action, generate a Korean question that asks the user which item they wish to select. The question should directly inquire about the user's intention to perform the specific select action mentioned. Refrain from including any English translation in the output.",
});

export const makeInputQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given the 'input' action described, generate a Korean question that asks the user to input the specified information. The directive should clearly prompt the user to enter the information related to the input action. Avoid providing any English translation in the output.",
});

export const makeClickQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given the 'click' action described, create a Korean question that asks the user whether they wish to proceed with the click action. The question should directly inquire about the user's intention to perform the specific click action mentioned. Refrain from including any English translation in the output.",
});

export const makeModifyQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given a description of a user action, convert this action into a clear and concise Korean question that could be presented to the user",
});

export const makeElementDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Generate a Korean description of the specific element on a webpage. Emphasize the immediate outcome or effect of this interaction, focusing on the functionality of the action. Avoid going into details about the nature, representation, or location of the element itself. The description should be clear, concise, and directly related to the user's interaction with the element.",
});

export const makeListDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Generate a Korean description of the list. Emphasize the immediate outcome or effect of selecting an item from this list, focusing on the functionality of the action. Avoid going into details about the nature or representation of the list itself or its location on the webpage. The description should be clear, concise, and directly related to what happens when a user interacts with the list by selecting an item.",
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
