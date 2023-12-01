import { Chat } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";

export type Prompt = {
  role: "SYSTEM" | "HUMAN" | "AI";
  content: string;
};

const chatNew = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-1106",
  maxTokens: 512,
  temperature: 0,
});

const chat = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo",
  maxTokens: 512,
  temperature: 0,
});

const chat16k = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-16k",
  maxTokens: 512,
  temperature: 0,
});

const chat4 = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4",
  temperature: 0.5,
  maxTokens: 1024,
});
const chat432k = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-32k",
  temperature: 0.5,
  maxTokens: 1024,
});

const MAX_CHARACTERS = 30000;

export const getAiResponse = async (
  prompts: Prompt[],
  isLong: boolean = false
) => {
  const promptMessages = prompts.map((prompt) => {
    const promptContent = prompt.content.slice(0, MAX_CHARACTERS) + "...";
    if (prompt.role === "HUMAN") {
      return new HumanChatMessage(promptContent);
    } else if (prompt.role === "AI") {
      return new AIChatMessage(promptContent);
    } else {
      return new SystemChatMessage(promptContent);
    }
  });

  let chatModel = isLong ? chat16k : chat;
  const response = await chatModel.call(promptMessages);

  return response.text;
};

export const getGpt4Response = async (
  prompts: Prompt[],
  long: boolean = false
) => {
  const promptMessages = prompts.map((prompt) => {
    const promptContent = prompt.content.slice(0, MAX_CHARACTERS) + "...";
    if (prompt.role === "HUMAN") {
      return new HumanChatMessage(promptContent);
    } else if (prompt.role === "AI") {
      return new AIChatMessage(promptContent);
    } else {
      return new SystemChatMessage(promptContent);
    }
  });

  let chatModel = long ? chat432k : chat4;
  const response = await chatModel.call(promptMessages);

  return response.text;
};

// interface SuggestedInteraction {
//   type: string;
//   elementI: string;
//   value?: string;
// }

// interface InteractionQuestion {
//   question: string;
// }

// type InteractionJson =
//   | { suggestedInteraction: SuggestedInteraction }
//   | { question: InteractionQuestion };

// export function isSuggestedInteraction(
//   obj: InteractionJson
// ): obj is { suggestedInteraction: SuggestedInteraction } {
//   return (
//     (obj as { suggestedInteraction: SuggestedInteraction })
//       .suggestedInteraction !== undefined
//   );
// }

// export function isInteractionQuestion(
//   obj: InteractionJson
// ): obj is { question: InteractionQuestion } {
//   return (obj as { question: InteractionQuestion }).question !== undefined;
// }

// export const getPossibleInteractionDescription = async (
//   rawHtml: string,
//   onePossibleInteractionsInString: string,
//   screenDescription: string
// ) => {
//   const parsingPossibleInteractionPrompts: Prompt[] = [
//     {
//       role: "SYSTEM",
//       content:
//         `You are a web developer. You will have the whole html and an action element with actionType and i attribute. You need to take the html into consideration, and describe what user can get after interacting with that element.
//         Consider the description of the webpage where these elements are located:  ${screenDescription}` +
//         `Output the purpose using "To ~" without providing additional context.`,
//     },
//   ];

//   const htmlPrompt: Prompt = {
//     role: "HUMAN",
//     content: `html is ${rawHtml} \n actions elements include: ${onePossibleInteractionsInString}`,
//   };

//   return getAiResponse([...parsingPossibleInteractionPrompts, htmlPrompt]);
// };
