import { Chat, Prisma } from "@prisma/client";
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

const chat = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-16k",
  temperature: 0,
});

export const getAiResponse = async (prompts: Prompt[]) => {
  const promptMessages = prompts.map((prompt) => {
    if (prompt.role === "HUMAN") {
      return new HumanChatMessage(prompt.content);
    } else if (prompt.role === "AI") {
      return new AIChatMessage(prompt.content);
    } else {
      return new SystemChatMessage(prompt.content);
    }
  });

  const response = await chat.call(promptMessages);

  return response.text;
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

export const getScreenDescription = async (screenHtml: string) => {
  const describeScreenSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are a web developer, and you need to read the body HTML of a given website and describe the purpose of the website.`,
  };

  const htmlPrompt: Prompt = {
    role: "HUMAN",
    content: screenHtml,
  };

  return getAiResponse([describeScreenSystemPrompt, htmlPrompt]);
};

export const getUserObjective = async (chats: Chat[]) => {
  const findTaskObjectiveSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You need to examine the conversation between the user and the assistant and determine the user's objective. Output the objective using "To ~" without providing additional context.`,
  };

  const chatsPrompt: Prompt = {
    role: "HUMAN",
    content: chats
      .map(
        (chat) =>
          `${chat.role === "HUMAN" ? "User" : "Assistant"}: ${chat.content}`
      )
      .join("\n"),
  };

  return getAiResponse([findTaskObjectiveSystemPrompt, chatsPrompt]);
};

export interface ComponentInfo {
  context: string;
  action: {
    type: string;
    description: string;
  };
  description: string;
}

export const getComponentInfo = async ({
  componentHtml,
  pageDescription,
}: {
  componentHtml: string;
  pageDescription: string;
}) => {
  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are a web developer. You need to explain the context when the user interacts with a given HTML element and the action for the user to interact with the element.

Consider the description of the webpage where this element is located: ${pageDescription}

Output following JSON format in plain text. Never provide additional context.

{
  context : <context of the element>,
  action: {
    type: <click or input or scroll>
    description: <description of the action>
  },
  description: <describe the context and action in one sentence>
}`,
  };

  const componentHtmlPrompt: Prompt = {
    role: "HUMAN",
    content: componentHtml,
  };

  try {
    const componentJson = await getAiResponse([
      extractComponentSystemPrompt,
      componentHtmlPrompt,
    ]);
    const componentObj = JSON.parse(componentJson);
    // console.log(componentJson);
    return componentObj as ComponentInfo;
  } catch (error) {
    console.error("Error parsing JSON:", error);
  }
};

export const getOrderedTasks = async ({
  components,
  objective,
}: {
  components: Prisma.ComponentCreateInput[];
  objective: string;
}) => {
  const orderTasksSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
    You need to plan the sequence of following actions:
    ${components
      .map(
        (comp, i) => `Possible Actions:
      - ${comp.description} (i=${i})`
      )
      .join("\n")}

    Consider the user's objective: ${objective}.

    Actions should be selected in an order to advance to the next page.
    Return the list of actions as a numbered list in the format:
    
    #. First action (i=<i>)
    #. Second action (i=<i>)
    
    The entries must be consecutively numbered, starting with 1. The number of each entry must be followed by a period.
    Do not include any headers before your list or follow your list with any other output.`,
  };

  return getAiResponse([orderTasksSystemPrompt]);
};
