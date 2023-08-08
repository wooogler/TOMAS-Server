import { FastifyRequest } from "fastify";
import {
  AnswerInput,
  ConfirmInput,
  CreateHumanChatInput,
  NavigateInput,
} from "./chat.schema";
import {
  answerForInput,
  answerForSelect,
  createHumanChat,
  firstOrder,
  getChats,
  navigate,
  confirm,
} from "./chat.service";

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

export async function navigateHandler(
  request: FastifyRequest<{ Body: NavigateInput }>
) {
  const screenResult = await navigate(request.body);
  return screenResult;
}

export async function firstOrderHandler(
  request: FastifyRequest<{ Body: CreateHumanChatInput }>
) {
  const navigateResponse = await firstOrder(request.body);
  return navigateResponse;
}

export async function answerForInputHandler(
  request: FastifyRequest<{ Body: AnswerInput }>
) {
  const answerResponse = await answerForInput(request.body);
  return answerResponse;
}

export async function answerForSelectHandler(
  request: FastifyRequest<{ Body: AnswerInput }>
) {
  const answerResponse = await answerForSelect(request.body);
  return answerResponse;
}

export async function confirmHandler(
  request: FastifyRequest<{ Body: ConfirmInput }>
) {
  const answerResponse = await confirm(request.body);
  return answerResponse;
}
