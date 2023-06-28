import prisma from "../../utils/prisma";
import { CreateHumanChatInput } from "./chat.schema";

export async function createHumanChat(data: CreateHumanChatInput) {
  return prisma.chat.create({
    data: {
      role: "HUMAN",
      content: data.content,
    },
  });
}

export function getChats() {
  return prisma.chat.findMany();
}
