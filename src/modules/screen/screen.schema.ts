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

const scrollSchema = z.object({
  i: z.string(),
});

const hoverSchema = z.object({
  i: z.string(),
});

const screenResponseSchema = z.object({
  rawHtml: z.string(),
  simpleHtml: z.string(),
});

export type NavigateInput = z.infer<typeof navigateSchema>;
export type ClickInput = z.infer<typeof clickSchema>;
export type TextInput = z.infer<typeof inputSchema>;
export type ScrollInput = z.infer<typeof scrollSchema>;
export type HoverInput = z.infer<typeof hoverSchema>;

export const { schemas: screenSchemas, $ref } = buildJsonSchemas(
  {
    navigateSchema,
    clickSchema,
    inputSchema,
    scrollSchema,
    hoverSchema,
    screenResponseSchema,
  },
  {
    $id: "ScreenSchema",
  }
);
