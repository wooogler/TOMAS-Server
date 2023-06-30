import { FastifyReply, FastifyRequest } from "fastify";
import {
  ClickInput,
  HoverInput,
  NavigateInput,
  ScrollInput,
  TextInput,
} from "./screen.schema";
import {
  click,
  inputText,
  navigate,
  scroll,
  hover,
  goBack,
} from "./screen.service";

export async function navigateHandler(
  request: FastifyRequest<{ Body: NavigateInput }>,
  reply: FastifyReply
) {
  try {
    const screenResult = await navigate(request.body);
    return reply.code(200).send(screenResult);
  } catch (e) {
    console.error(e);
    return reply.code(500).send(e);
  }
}

export async function clickHandler(
  request: FastifyRequest<{ Body: ClickInput }>,
  reply: FastifyReply
) {
  try {
    const screenResult = await click(request.body);
    return reply.code(200).send(screenResult);
  } catch (e) {
    console.error(e);
    return reply.code(500).send(e);
  }
}
export async function inputTextHandler(
  request: FastifyRequest<{ Body: TextInput }>,
  reply: FastifyReply
) {
  try {
    const screenResult = await inputText(request.body);
    return reply.code(200).send(screenResult);
  } catch (e) {
    console.error(e);
    return reply.code(500).send(e);
  }
}

export async function scrollHandler(
  request: FastifyRequest<{ Body: ScrollInput }>,
  reply: FastifyReply
) {
  try {
    const screenResult = await scroll(request.body);
    return reply.code(200).send(screenResult);
  } catch (e) {
    console.error(e);
    return reply.code(500).send(e);
  }
}

export async function hoverHandler(
  request: FastifyRequest<{ Body: HoverInput }>,
  reply: FastifyReply
) {
  try {
    const screenResult = await hover(request.body);
    return reply.code(200).send(screenResult);
  } catch (e) {
    console.error(e);
    return reply.code(500).send(e);
  }
}

export async function goBackHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const screenResult = await goBack();
    return reply.code(200).send(screenResult);
  } catch (e) {
    console.error(e);
    return reply.code(500).send(e);
  }
}
