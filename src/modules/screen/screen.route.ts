import { FastifyInstance } from "fastify";
import { navigateHandler } from "./screen.controller";
import { $ref } from "./screen.schema";

async function screenRoutes(server: FastifyInstance) {
  server.post(
    "/navigate",
    {
      schema: {
        body: $ref("navigateSchema"),
        response: { 200: $ref("navigateResponseSchema") },
      },
    },
    navigateHandler
  );
}

export default screenRoutes;
