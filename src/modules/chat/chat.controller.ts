import { FastifyRequest } from "fastify";
import { CreateHumanChatInput } from "./chat.schema";
import { createHumanChat, getChats } from "./chat.service";

export async function createHumanChatHandler(
  request: FastifyRequest<{ Body: CreateHumanChatInput }>
) {
  const chat = await createHumanChat({ ...request.body });
  return chat;
}
export async function getChatsHandler() {
  const chats = await getChats();
  return chats;
}
