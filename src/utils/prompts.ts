import { FewShotPromptTemplate } from "langchain";
import { ChatOpenAI } from "langchain/chat_models/openai";
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
    content: `You are a React developer. You read the HTML code of a legacy website and want to organize it by purpose into five large React components. Each component has an attribute called i, which is equal to the value of i in the top-level tag that the component contains. Show your React components as follows:

    <Name of the component i="{i}">
    Description of the UI included in the component over 50 words
    </Name of the component>`,
  },
];

export const analyzeActionComponentPrompts: Prompt[] = [
  {
    role: "SYSTEM",
    content: `You are a web developer working on an internal system that on-site customer-facing staff can see only. Think about the moment when staff might need a given component and create a question that the staff can ask a customer at the moment. Output following JSON format in plain text. Never provide additional context.

    {
      description: <description of the component>,
      moment: <moment>,
      question: <question>,
    }`,
  },
];

export const describeActionComponentPrompts: Prompt[] = [
  {
    role: "SYSTEM",
    content: `You are a web developer who explains why people should use the given part of the website. Output the purpose using "To ~" without providing additional context.`,
  },
];
