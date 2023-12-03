import { Chat } from "@prisma/client";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { ActionComponent } from "../utils/pageHandler";
import {
  QuestionCache,
  loadCacheFromFile,
  loadJsonFromFile,
  saveCacheToFile,
} from "../utils/fileUtil";
import { generateIdentifier } from "../utils/htmlHandler";
import { AnswerResponse } from "../modules/chat/chat.schema";
import { Action } from "../agents/parsingAgent";

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
    content: `Based on the conversation between the system and the user, describe the user's context. The user has ID and password for the website.
    
Conversation:
${conversation}
    `,
  };

  const userGoalResponse = await getGpt4Response([findUserGoalPrompt]);
  // console.log(findUserGoalPrompt.content);
  // console.log(userGoalResponse);
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
    content: `Based on the conversation and user's context, output any relevant information in a one-level JSON format. The JSON should not contain any nested objects or arrays.

Conversation: 
${conversation}

User's context: ${userContext}

Output:
{
  "attr1": <value2>,
  "attr2": <value2>,
  ...
}
`,
  };

  const userInfoResponse = await getGpt4Response([findUserInfoPrompt]);
  console.log(userInfoResponse);
  const jsonRegex = /{.*?}/s;
  const userInfoJson = userInfoResponse.match(jsonRegex);
  if (userInfoJson) {
    const userInfo = JSON.parse(userInfoJson[0]);
    return { ...defaultUserInfo, ...userInfo };
  }

  return { ...defaultUserInfo };
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

  return await getGpt4Response([makeConfirmationPrompt]);
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
    content: await getGpt4Response([makeConfirmationPrompt]),
  };

  const modifyConfirmationPrompt: Prompt = {
    role: "HUMAN",
    content:
      "The user does not see the screen and is unfamiliar with technology, so please do not mention the element and the action on the screen, and avoid the jargon, mechanical terms, and terms that are too specific to the webpage.",
  };

  return await getGpt4Response([
    makeConfirmationPrompt,
    firstConfirmationPrompt,
    modifyConfirmationPrompt,
  ]);
}

export const makeSelectQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given the 'select' action, output a simple Korean question that asks the user which item they wish to select. The question should directly inquire about the user's intention to perform the specific select action mentioned. Avoid providing any English translation and double quotes in the output.",
});

export const makeInputQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given the 'input' action described, output a simple Korean question that asks the user to input the specified information. The directive should clearly prompt the user to enter the information related to the input action. Avoid providing any English translation and double quotes in the output.",
});

export const makeClickQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given the 'click' action described, output a simple Korean question that asks the user whether they wish to proceed with the click action. The question should directly inquire about the user's intention to perform the specific click action mentioned. Avoid providing any English translation and double quotes in the output",
});

export const makeModifyQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Given a description of a user action, convert this action into a clear and concise Korean question that could be presented to the user",
});

export const makeElementDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Describe the given element in Korean. Emphasize the outcome or effect of this interaction, focusing on the functionality of the action. Avoid using technical terms like modal.",
});

export const makeGroupDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Describe the given element in Korean. Emphasize the outcome or effect of this interaction, focusing on the functionality of the action. Avoid using technical terms like modal.",
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

export async function getUserFriendlyQuestion({
  screenDescriptionKorean,
  componentDescription,
  componentQuestion,
  componentHtml,
  actionValue,
}: {
  screenDescriptionKorean: string;
  componentDescription: string;
  componentQuestion: string;
  componentHtml: string;
  actionValue?: string;
}): Promise<string> {
  const questionCache = new QuestionCache("questionCache.json");
  const identifier = generateIdentifier(componentHtml) + actionValue;
  const cachedQuestion = questionCache.get(identifier);
  if (cachedQuestion) {
    return cachedQuestion.question;
  }

  const makeUserFriendlyQuestionPrompt: Prompt = {
    role: "SYSTEM",
    content: `당신은 노인들에게 스마트폰 사용방법을 친절하게 설명하는 사회복지사입니다. 주어진 화면 설명, UI 요소 설명, 그리고 요소에 대한 질문을 토대로, 해당 요소를 노인이 이해할 수 있을 수준으로 간단하게 설명하고 해당 요소와 상호작용할 지 묻는 말을 자연어로 생성해주세요.

화면 설명: ${screenDescriptionKorean}
UI 요소 설명: ${componentDescription}
요소에 대한 질문: ${componentQuestion}`,
  };
  console.log(makeUserFriendlyQuestionPrompt.content);

  const userFriendlyQuestion = await getGpt4Response(
    [makeUserFriendlyQuestionPrompt],
    false,
    1.0
  );

  console.log(userFriendlyQuestion);

  questionCache.set(identifier, {
    question: userFriendlyQuestion,
  });
  questionCache.save();

  return userFriendlyQuestion;
}
