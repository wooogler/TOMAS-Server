import { FastifyInstance } from "fastify";
import {
  answerForFilterHandler,
  answerForInputHandler,
  answerForSelectHandler,
  confirmHandler,
  createHumanChatHandler,
  deleteChatsHandler,
  firstOrderHandler,
  getChatsHandler,
  getNewestChatHandler,
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
          201: {
            oneOf: [$ref("answerResponseSchema"), $ref("selectResponseSchema")],
          },
        },
      },
    },
    firstOrderHandler
  );

  server.post(
    "/answer/input",
    {
      schema: {
        body: $ref("answerInputSchema"),
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
        body: $ref("selectInputSchema"),
        response: {
          201: $ref("answerResponseSchema"),
        },
      },
    },
    answerForSelectHandler
  );

  server.post(
    "/answer/filter",
    {
      schema: {
        body: $ref("filterInputSchema"),
        response: {
          201: $ref("filterResponseSchema"),
        },
      },
    },
    answerForFilterHandler
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
  server.get(
    "/newest",
    {
      schema: {
        response: { 200: $ref("chatResponseSchema") },
      },
    },
    getNewestChatHandler
  );

  server.delete("/", deleteChatsHandler);
}

export default chatRoutes;
