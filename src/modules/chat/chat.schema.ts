import { z } from "zod";
import { buildJsonSchemas } from "fastify-zod";

const navigateSchema = z.object({
  url: z.string().url({ message: "Invalid URL" }),
});

const chatInput = {
  role: z.enum(["AI", "HUMAN"]),
  content: z.string(),
  type: z.string(),
};

const chatGenerated = {
  id: z.string(),
  createdAt: z.string(),
};

const ActionComponentSchema = z.object({
  i: z.string(),
  actionType: z.string(),
  description: z.string().optional(),
  content: z.string(),
  html: z.string(),
  question: z.string().optional(),
});

const createHumanChatSchema = z.object({
  content: z.string(),
});

const answerInputSchema = z.object({
  content: z.string(),
  component: ActionComponentSchema,
});

const confirmSchema = z.object({
  content: z.string(),
  component: ActionComponentSchema,
  actionValue: z.string().optional(),
});

const chatResponseSchema = z.object({
  ...chatInput,
  ...chatGenerated,
});

const chatsResponseSchema = z.array(chatResponseSchema);

const navigateResponseSchema = z.object({
  screenDescription: z.string(),
  type: z.string(),
});

const answerResponseSchema = z.object({
  component: ActionComponentSchema,
  type: z.string(),
  screenDescription: z.string().optional(),
  actionValue: z.string().optional(),
});

const optionSchema = z.union([
  z.string(),
  z.record(z.union([z.string(), z.array(z.string())])),
]);

const selectSchema = z.object({
  i: z.string(),
  description: z.string().optional(),
  data: optionSchema,
  actionType: z.string(),
  content: z.string(),
});

const selectResponseSchema = z.object({
  components: z.array(selectSchema),
  component: ActionComponentSchema,
  screenDescription: z.string().optional(),
  type: z.string(),
});

const selectInputSchema = z.object({
  component: ActionComponentSchema,
  option: selectSchema.nullable(),
  content: z.string(),
});

const filterInputSchema = z.object({
  components: z.array(selectSchema),
  content: z.string(),
});

const filterResponseSchema = z.object({
  components: z.array(selectSchema),
  type: z.string(),
});

export type CreateHumanChatInput = z.infer<typeof createHumanChatSchema>;
export type NavigateInput = z.infer<typeof navigateSchema>;
export type AnswerInput = z.infer<typeof answerInputSchema>;
export type SelectInput = z.infer<typeof selectInputSchema>;
export type FilterInput = z.infer<typeof filterInputSchema>;
export type ConfirmInput = z.infer<typeof confirmSchema>;
export type AnswerResponse = z.infer<typeof answerResponseSchema>;
export type SelectResponse = z.infer<typeof selectResponseSchema>;
export type FilterResponse = z.infer<typeof filterResponseSchema>;
export type navigateResponse = z.infer<typeof navigateResponseSchema>;

export const { schemas: chatSchemas, $ref } = buildJsonSchemas(
  {
    createHumanChatSchema,
    navigateSchema,
    chatResponseSchema,
    chatsResponseSchema,
    navigateResponseSchema,
    answerResponseSchema,
    answerInputSchema,
    confirmSchema,
    selectResponseSchema,
    selectInputSchema,
    filterResponseSchema,
    filterInputSchema,
  },
  {
    $id: "ChatSchema",
  }
);
