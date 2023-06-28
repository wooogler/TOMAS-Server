import Fastify from "fastify";
import chatRoutes from "./modules/chat/chat.route";
import screenRoutes from "./modules/screen/screen.route";
import { chatSchemas } from "./modules/chat/chat.schema";
import { screenSchemas } from "./modules/screen/screen.schema";

export const server = Fastify({ logger: true });

async function main() {
  for (const schema of [...chatSchemas, ...screenSchemas]) {
    server.addSchema(schema);
  }

  server.register(chatRoutes, { prefix: "/api/chats" });
  server.register(screenRoutes, { prefix: "/api/screen" });
  try {
    await server.listen({ port: 8000, host: "0.0.0.0" });
    console.log(`Server ready at http://localhost:8000`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
