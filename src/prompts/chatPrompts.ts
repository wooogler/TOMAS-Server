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

export async function getUserContext(chats: Chat[]) {
  const actionChats = chats.filter((chat) => !chat.type.startsWith("confirm"));
  const converationPrompt: Prompt = makeConversationPrompt(actionChats);
  const findUserContextPrompt: Prompt = {
    role: "SYSTEM",
    content: `Based on the conversation between the system and the user, describe the user's context. Please keep all useful information from the conversation in the context considering the user's goal. Start with "User's Context: "`,
  };
  const userContext = await getAiResponse([
    findUserContextPrompt,
    converationPrompt,
  ]);
  return userContext;
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

export const makeQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Create a Korean question that asks for user confirmation to perform the action described in the input. Do not mention the English translation in the output.",
  // "Create a Korean question that ask older adults if they want to perform the given action. Do not mention the English translation in the output.",
});

export const makeSelectQuestionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Create a Korean question that asks older adults to choose an option based on the context. Do not mention the English translation in the output.",
});

export const makeElementDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Generate a Korean description explaining the action preformed by interacting with the element on a webpage. Focus on describing the function without detailing what the element represents or where it is located.",
});

export const makeListDescriptionPrompt = (): Prompt => ({
  role: "HUMAN",
  content:
    "Generate a Korean description explaining the action preformed by selecting an item in the list on a webpage. Focus on describing the function without detailing what the list represents or where it is located.",
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
