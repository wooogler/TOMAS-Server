import { buildJsonSchemas } from "fastify-zod";
import { z } from "zod";

const navigateSchema = z.object({
  url: z.string().url({ message: "Invalid URL" }),
});

const clickSchema = z.object({
  i: z.string(),
});

const inputSchema = z.object({
  i: z.string(),
  value: z.string(),
});

export type NavigateInput = z.infer<typeof navigateSchema>;

export const { schemas: screenSchemas, $ref } = buildJsonSchemas(
  {
    navigateSchema,
    clickSchema,
    inputSchema,
  },
  {
    $id: "ScreenSchema",
  }
);
