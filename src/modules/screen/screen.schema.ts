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

const screenResponseSchema = z.object({
  rawHtml: z.string(),
  simpleHtml: z.string(),
});

export type NavigateInput = z.infer<typeof navigateSchema>;
export type clickInput = z.infer<typeof clickSchema>;
export type textInput = z.infer<typeof inputSchema>;
export type scrollInput = z.infer<typeof scrollSchema>;
export type hoverInput = z.infer<typeof hoverSchema>;

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
