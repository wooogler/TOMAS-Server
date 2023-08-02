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
  maxTokens: -1,
  temperature: 0,
});

const chat4 = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4",
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

export const getGpt4Response = async (prompts: Prompt[]) => {
  const promptMessages = prompts.map((prompt) => {
    if (prompt.role === "HUMAN") {
      return new HumanChatMessage(prompt.content);
    } else if (prompt.role === "AI") {
      return new AIChatMessage(prompt.content);
    } else {
      return new SystemChatMessage(prompt.content);
    }
  });

  const response = await chat4.call(promptMessages);

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

export const getScreenDescription = async (screenHtml: string) => {
  const describeScreenSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are a web developer, and you need to read the body HTML of a given webpage and describe its purpose in a single sentence.`,
  };

  const htmlPrompt: Prompt = {
    role: "HUMAN",
    content: screenHtml,
  };

  const screenDescription = await getAiResponse([
    describeScreenSystemPrompt,
    htmlPrompt,
  ]);
  console.log("screen description: ", screenDescription);

  return screenDescription;
};

export const getComponentFeature = async (
  componentHtml: string,
  screenDescription: string
) => {
  const describeComponentFeaturePrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `
      You are a web developer who explains why people should use the given part of the website. 
      Output the purpose using "To ~" without providing additional context.
      Consider the description of the webpage where this element is located: ${screenDescription}`,
    },
  ];

  const htmlPrompt: Prompt = {
    role: "HUMAN",
    content: componentHtml,
  };

  return getAiResponse([...describeComponentFeaturePrompts, htmlPrompt]);
};

export const makeChatsPrompt = (chats: Chat[]): Prompt => ({
  role: "HUMAN",
  content: chats
    .map(
      (chat) => `${chat.role === "HUMAN" ? "User" : "System"}: ${chat.content}`
    )
    .join("\n"),
});

export const getUserObjective = async (chats: Chat[]) => {
  const findTaskObjectiveSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You need to examine the conversation between the user and the assistant and determine the user's objective. Output the objective using "To ~" without providing additional context.`,
  };

  const chatsPrompt: Prompt = makeChatsPrompt(chats);

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
    return componentObj as ComponentInfo;
  } catch (error) {
    console.error("Error parsing JSON:", error);
  }
};

function extractIValues(inputStr: string) {
  const regex = /i=(\d+)/g;
  let match;
  const result = [];

  while ((match = regex.exec(inputStr)) !== null) {
    result.push(parseInt(match[1]));
  }

  return result;
}

export const getTaskOrder = async ({
  components,
  objective,
  pageDescription,
}: {
  components: Prisma.ComponentCreateInput[];
  objective: string;
  pageDescription: string;
}) => {
  const orderTasksSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are looking at a webpage.
The description of the webpage: ${pageDescription}

You need to plan the sequence of following possible actions on a single webpage.
Possible Actions:
${components
  .map((comp, tmpIndex) => `- ${comp.description} (i=${tmpIndex})`)
  .join("\n")}

Consider the user's objective: ${objective}

Actions should be selected in an order to advance to the next page.
Return the list of actions as a numbered list in the format:

#. First action (i=<i>)
#. Second action (i=<i>)

The entries must be consecutively numbered, starting with 1. The number of each entry must be followed by a period.
Do not include any headers before your list or follow your list with any other output.`,
  };

  const response = await getAiResponse([orderTasksSystemPrompt]);
  console.log(`Prompt: 
${orderTasksSystemPrompt.content}
`);
  console.log(`Response:
${response}
`);

  return extractIValues(response);
};

interface SuggestedInteraction {
  type: string;
  elementI: string;
  value?: string;
}

interface InteractionQuestion {
  question: string;
}

type InteractionJson =
  | { suggestedInteraction: SuggestedInteraction }
  | { question: InteractionQuestion };

export const getInteractionOrQuestion = async ({
  component,
  chats,
}: {
  component: Prisma.ComponentCreateInput;
  chats: Chat[];
}): Promise<InteractionJson> => {
  const interactionSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are an agent interacting with HTML on behalf of a user. Let's think step by step.
First, read the possible interaction that the agent can do with the given HTML element. Second, read the chat history with users and think about whether you have enough information to interact with the element. 

If yes, suggest the interaction with the element based on the chat history. The output should follow JSON format in plain text without providing additional context.
{
  "suggestedInteraction": {
    "type": <click or input or scroll>
    "elementI": <i attribute of the target element>
    "value": <if the interaction type is input, fill the text for input>
  }
}

If no, create a natural language question to ask the user to get information to interact with the element. The output should follow JSON format in plain text without providing additional context.
{
  "question": <question to user>
}
`,
  };

  const interactionUserPrompt: Prompt = {
    role: "HUMAN",
    content: `
HTML element:
${component.html}

Possible interaction with the element:
${component.description}

Chat history:
${makeChatsPrompt(chats)}
    `,
  };

  try {
    const interactionJson = await getGpt4Response([
      interactionSystemPrompt,
      interactionUserPrompt,
    ]);
    const componentObj: InteractionJson = JSON.parse(interactionJson);
    return componentObj;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    throw error;
  }
};

export function isSuggestedInteraction(
  obj: InteractionJson
): obj is { suggestedInteraction: SuggestedInteraction } {
  return (
    (obj as { suggestedInteraction: SuggestedInteraction })
      .suggestedInteraction !== undefined
  );
}

export function isInteractionQuestion(
  obj: InteractionJson
): obj is { question: InteractionQuestion } {
  return (obj as { question: InteractionQuestion }).question !== undefined;
}



export const getPossibleInteractionDescription = async (
  rawHtml: string,
  onePossibleInteractionsInString: string,
  screenDescription: string
) => {
  const parsingPossibleInteractionPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content:
        `You are a web developer. You will have the whole html and an action element with actionType and i attribute. You need to take the html into consideration, and describe what user can get after interacting with that element.
        Consider the description of the webpage where these elements are located:  ${screenDescription}` +
        `Output the purpose using "To ~" without providing additional context.`,
    },
  ];

  const htmlPrompt: Prompt = {
    role: "HUMAN",
    content: `html is ${rawHtml} \n actions elements include: ${onePossibleInteractionsInString}`,
  };

  return getAiResponse([...parsingPossibleInteractionPrompts, htmlPrompt]);
};
