import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import prisma from "../../utils/prisma";
import { CreateHumanChatInput } from "./chat.schema";
import { ChatOpenAI } from "langchain/chat_models/openai";

const chat = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-16k",
  temperature: 0.2,
});

export async function createHumanChat(input: CreateHumanChatInput) {
  await prisma.chat.create({
    data: {
      role: "HUMAN",
      content: input.content,
    },
  });

  //   const screen;
  const systemMessage = new SystemChatMessage("You are a helpful assistant.");

  const chats = await prisma.chat.findMany();
  const chatMessages = chats.map((chat) => {
    if (chat.role === "HUMAN") {
      return new HumanChatMessage(chat.content);
    } else {
      return new AIChatMessage(chat.content);
    }
  });

  // const response = await chat.call([systemMessage, ...chatMessages]);
  // await prisma.chat.create({
  //   data: {
  //     role: "AI",
  //     content: response.text,
  //   },
  // });
}

export function getChats() {
  return prisma.chat.findMany();
}
