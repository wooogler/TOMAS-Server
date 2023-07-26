import { FastifyReply, FastifyRequest } from "fastify";
import {
  ClickInput,
  HoverInput,
  NavigateInput,
  ScrollInput,
  TextInput,
} from "./screen.schema";
import { navigate } from "./screen.service";

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
