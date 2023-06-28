import { FastifyReply, FastifyRequest } from "fastify";
import { NavigateInput } from "./screen.schema";
import { navigate } from "./screen.service";

export async function navigateHandler(
  request: FastifyRequest<{ Body: NavigateInput }>,
  reply: FastifyReply
) {
  try {
    await navigate(request.body);
    return reply.code(200).send(`Successfully navigate to ${request.body.url}`);
  } catch (e) {
    console.error(e);
    return reply.code(500).send(e);
  }
}
