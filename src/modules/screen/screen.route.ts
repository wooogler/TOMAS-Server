import { FastifyInstance } from "fastify";
import { navigateHandler } from "./screen.controller";
import { $ref } from "./screen.schema";

async function screenRoutes(server: FastifyInstance) {
  server.post(
    "/navigate",
    {
      schema: {
        body: $ref("navigateSchema"),
      },
    },
    navigateHandler
  );
}

export default screenRoutes;
