import { Chat } from "@prisma/client";
import { Prompt, getAiResponse } from "../utils/langchainHandler";
import { ActionComponent } from "../utils/pageHandler";
import {
  loadQuestionCacheFromFile,
  saveQuestionCacheToFile,
} from "../utils/fileUtil";
import { generateIdentifier } from "../utils/htmlHandler";

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
  const converationPrompt: Prompt = makeConversationPrompt(chats);
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
  const questionCache = loadQuestionCacheFromFile();
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

  questionCache.set(identifier, newQuestion);
  saveQuestionCacheToFile(questionCache);

  return newQuestion;
}

export async function makeQuestionForConfirmation(
  component: ActionComponent,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompt: Prompt = {
    role: "SYSTEM",
    content: `Create a natural language question to ask whether the user wants to do the given action${
      component.actionType === "input" ? " with value" : ""
    }.

Action: ${component.description}
${component.actionType === "input" ? `Value: ${actionValue}` : ""}

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
