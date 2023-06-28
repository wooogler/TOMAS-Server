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

const Interaction = z.enum([
  "GOTO",
  "SCROLL",
  "CLICK",
  "INPUT",
  "HOVER",
  "BACK",
]);

// const ComponentSchema = z.lazy(() =>
//   z.object({
//     id: z.string(),
//     html: z.string(),
//     screen: ScreenSchema.optional(),
//     screenId: z.string().optional(),
//     onAction: ActionSchema.optional(),
//     onActionId: z.string().optional(),
//   })
// );

// const ActionSchema = z.lazy(() =>
//   z.object({
//     id: z.string(),
//     type: Interaction,
//     value: z.string(),
//     nextScreen: ScreenSchema.optional(),
//     onComponet: ComponentSchema.optional(),
//   })
// );

// const ScreenSchema = z.object({
//   id: z.string(),
//   url: z.string().url({ message: "Invalid URL" }),
//   html: z.string(),
//   simpleHtml: z.string(),
//   components: z.array(ComponentSchema),
//   prevAction: ActionSchema.optional(),
//   prevActionId: z.string().optional(),
// });

const navigateResponseSchema = z.object({
  rawHtml: z.string(),
  simpleHtml: z.string(),
});

export type NavigateInput = z.infer<typeof navigateSchema>;

export const { schemas: screenSchemas, $ref } = buildJsonSchemas(
  {
    navigateSchema,
    clickSchema,
    inputSchema,
    navigateResponseSchema,
  },
  {
    $id: "ScreenSchema",
  }
);
