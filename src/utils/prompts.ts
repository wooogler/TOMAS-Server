import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";

export type Prompt = {
  role: "SYSTEM" | "HUMAN" | "AI";
  content: string;
};

export const makePromptMessages = (prompts: Prompt[]) => {
  const promptMessages = prompts.map((prompt) => {
    if (prompt.role === "HUMAN") {
      return new HumanChatMessage(prompt.content);
    } else if (prompt.role === "AI") {
      return new AIChatMessage(prompt.content);
    } else {
      return new SystemChatMessage(prompt.content);
    }
  });

  return promptMessages;
};

export const findComponentPrompts: Prompt[] = [
  {
    role: "SYSTEM",
    content: `You are a React developer. You read the HTML code of a legacy website and want to organize it by purpose into seven large React components. Each component has an attribute called i, which is equal to the value of i in the top-level tag that the component contains. List your React components as follows:

    <{Name of the component} i="{i}">
    {Description of the UI included in the component over 50 words}
    </{Name of the component}>`,
  },
];
