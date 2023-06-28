import { z } from "zod";
import { buildJsonSchemas } from "fastify-zod";

const chatInput = {
  role: z.enum(["AI", "HUMAN"]),
  content: z.string(),
};

const chatGenerated = {
  id: z.string(),
  createdAt: z.string(),
};

const createHumanChatSchema = z.object({
  content: z.string(),
});

const chatResponseSchema = z.object({
  ...chatInput,
  ...chatGenerated,
});

const chatsResponseSchema = z.array(chatResponseSchema);

export type CreateHumanChatInput = z.infer<typeof createHumanChatSchema>;

export const { schemas: chatSchemas, $ref } = buildJsonSchemas(
  {
    createHumanChatSchema,
    chatResponseSchema,
    chatsResponseSchema,
  },
  {
    $id: "ChatSchema",
  }
);
