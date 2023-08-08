import { FastifyInstance } from "fastify";
import {
  answerForInputHandler,
  answerForSelectHandler,
  confirmHandler,
  createHumanChatHandler,
  firstOrderHandler,
  getChatsHandler,
  navigateHandler,
} from "./chat.controller";
import { $ref } from "./chat.schema";

async function chatRoutes(server: FastifyInstance) {
  server.post(
    "/navigate",
    {
      schema: {
        body: $ref("navigateSchema"),
        response: {
          200: $ref("navigateResponseSchema"),
        },
      },
    },
    navigateHandler
  );

  server.post(
    "/order",
    {
      schema: {
        body: $ref("createHumanChatSchema"),
        response: {
          201: $ref("answerResponseSchema"),
        },
      },
    },
    firstOrderHandler
  );

  server.post(
    "/answer/input",
    {
      schema: {
        body: $ref("answerSchema"),
        response: {
          201: $ref("answerResponseSchema"),
        },
      },
    },
    answerForInputHandler
  );

  server.post(
    "/answer/select",
    {
      schema: {
        body: $ref("answerSchema"),
        response: {
          201: $ref("answerResponseSchema"),
        },
      },
    },
    answerForSelectHandler
  );

  server.post(
    "/confirm",
    {
      schema: {
        body: $ref("confirmSchema"),
        response: {
          201: $ref("answerResponseSchema"),
        },
      },
    },
    confirmHandler
  );

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
