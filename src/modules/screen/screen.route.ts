import { FastifyInstance } from "fastify";
import {
  navigateHandler,
  clickHandler,
  inputTextHandler,
  scrollHandler,
  hoverHandler,
  goBackHandler,
} from "./screen.controller";
import { $ref } from "./screen.schema";

async function screenRoutes(server: FastifyInstance) {
  server.post(
    "/navigate",
    {
      schema: {
        body: $ref("navigateSchema"),
        response: { 200: $ref("screenResponseSchema") },
      },
    },
    navigateHandler
  );

  server.post(
    "/click",
    {
      schema: {
        body: $ref("clickSchema"),
        response: { 200: $ref("screenResponseSchema") },
      },
    },
    clickHandler
  );

  server.post(
    "/inputText",
    {
      schema: {
        body: $ref("inputSchema"),
        response: { 200: $ref("screenResponseSchema") },
      },
    },
    inputTextHandler
  );

  server.post(
    "/scroll",
    {
      schema: {
        body: $ref("scrollSchema"),
        response: { 200: $ref("screenResponseSchema") },
      },
    },
    scrollHandler
  );

  server.post(
    "/hover",
    {
      schema: {
        body: $ref("hoverSchema"),
        response: { 200: $ref("screenResponseSchema") },
      },
    },
    hoverHandler
  );

  server.post(
    "/goBack",
    {
      schema: {
        response: { 200: $ref("screenResponseSchema") },
      },
    },
    goBackHandler
  );
}

export default screenRoutes;
