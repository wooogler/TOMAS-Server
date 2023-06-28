import { FastifyInstance } from "fastify";
import { createHumanChatHandler, getChatsHandler } from "./chat.controller";
import { $ref } from "./chat.schema";

async function chatRoutes(server: FastifyInstance) {
  server.post(
    "/human",
    {
      schema: {
        body: $ref("createHumanChatSchema"),
        response: {
          201: $ref("chatResponseSchema"),
        },
      },
    },
    createHumanChatHandler
  );

  server.get(
    "/",
    {
      schema: {
        response: { 200: $ref("chatsResponseSchema") },
      },
    },
    getChatsHandler
  );
}

export default chatRoutes;
