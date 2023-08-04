import { Chat, Prisma } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import { ParsingResult } from "../modules/screen/screen.service";

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
  maxTokens: 4096,
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

export const getPageDescription = async (html: string) => {
  const describePageSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the HTML code, summarize the purpose of the web page it represents.
    
HTML code:
${html}`,
  };

  const pageDescription = await getAiResponse([describePageSystemPrompt]);
  console.log("page description: ", pageDescription);

  return pageDescription;
};

export const getModalDescription = async (
  html: string,
  pageDescription: string
) => {
  const describeModalSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the HTML code, summarize the purpose of the modal in the web page it represents.
    
Consider the description on the web page where the modal is located: ${pageDescription}

HTML code:
${html}`,
  };

  const htmlPrompt: Prompt = {
    role: "HUMAN",
    content: html,
  };

  const screenDescription = await getAiResponse([describeModalSystemPrompt]);
  console.log("modal description: ", screenDescription);

  return screenDescription;
};

export const getPartDescription = async (
  html: string,
  pageDescription: string
) => {
  const describePartSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the HTML code, summarize the purpose of the part in the web page it represents.
    
Consider the description on the webpage where the part is located: ${pageDescription}

HTML code:
${html}`,
  };

  const partDescription = await getAiResponse([describePartSystemPrompt]);
  console.log("part description: ", partDescription);

  return partDescription;
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
  screenDescription,
  actionType,
}: {
  componentHtml: string;
  screenDescription: string;
  actionType: string;
}) => {
  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are a web developer. You need to explain the context when the user interacts with a given HTML element and the action for the user to interact with the element.

Consider the description about where this element is located: ${screenDescription}

Output following JSON format in plain text. Never provide additional context.

{
  context : <the context when the user interacts with the element>,
  action: {
    type: ${actionType},
    description: <description of the action>
  },
  description: <describe the action based on the context starting with '${actionType} '>
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

export const getItemDescription = async ({
  itemHtml,
  screenDescription,
  prevDescription,
}: {
  itemHtml: string;
  screenDescription: string;
  prevDescription?: string;
}) => {
  const describeItemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
Describe an item in the list as a noun phrase with modifiers${
      prevDescription && ` with reference to the previous item's description`
    }. The description must include all the information in the item. The item is given in HTML code below.
${prevDescription && `Previous description: ${prevDescription}`}

Consider the description about where this item is located: ${screenDescription}

HTML code:
${itemHtml}

Do provide information, not the purpose of the HTML element.
`,
  };

  try {
    return await getAiResponse([describeItemPrompt]);
  } catch (error) {
    console.error("Error in loading item info: ", error);
  }
};

export const getSelectInfo = async ({
  componentHtml,
  screenDescription,
  actionType,
}: {
  componentHtml: string;
  screenDescription: string;
  actionType: string;
}) => {
  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are a web developer. You need to explain the context when the user see a given HTML element
    
The action of user is selecting one of the components in the given HTML element.

Consider the description about where this element is located: ${screenDescription}

Output following JSON format in plain text. Never provide additional context.

{
  context : <the context when the user interacts with the element>,
  action: {
    type: ${actionType},
    description: <description of the action>
  },
  description: <describe the action based on the context starting with '${actionType} one'>
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

export async function getUserContext(chats: Chat[]) {
  const chatsPrompt: Prompt = makeChatsPrompt(chats);
  const findUserContextPrompt: Prompt = {
    role: "SYSTEM",
    content: `
      Based on the conversation between the system and the user, describe the user's context. Please keep all useful information from the conversation in the context considering the user's goal.
      
      Conversation:

        `,
  };
  const userContext = await getAiResponse([findUserContextPrompt, chatsPrompt]);
  return userContext;
}

export async function makeQuestionForActionValue(
  pageDescription: string,
  componentDescription: string | undefined
) {
  const makeQuestionPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are looking at a webpage.
The description of the webpage: ${pageDescription}

You need to create a natural language question to ask the user to achieve a given action.
Action:
${componentDescription}
`,
  };
  return await getAiResponse([makeQuestionPrompt]);
}

export async function findInputTextValue(
  pageDescription: string,
  componentDescription: string | undefined,
  userContext: string
) {
  const inputComponentPrompt: Prompt = {
    role: "SYSTEM",
    content: `
          You are the AI assistant who sees the abstraction of part of the user's web page. Based on the user's context, you have to decide what to input in the given component abstraction on the web page. If you cannot decide what content to fill in the input box, please explain why you can't. Don't assume general context; only refer to the given user's context.
    
          Description of the web page:
          ${pageDescription}
    
          Component description:
          ${componentDescription}
          
          User's context:
          ${userContext}
    
          Output needs to follow one of the JSON formats in plain text. Never provide additional context.
          {
            reason: <the reason why you need to input certain content>,
            value: <the text that is most relevant for the given component>
          }
          OR
          {
            reason: <the reason why you cannot decide what content to input>,
            value: null
          }
        `,
  };
  return await getAiResponse([inputComponentPrompt]);
}

export async function findSelectValue(
  pageDescription: string,
  componentDescription: string,
  userContext: string
) {
  const inputComponentPrompt: Prompt = {
    role: "SYSTEM",
    content: `
            You are the AI assistant who sees the abstraction of part of the user's web page. Based on the user's context, you have to decide what to input in the given component abstraction on the web page. If you cannot decide what content to fill in the input box, please explain why you can't. Don't assume general context; only refer to the given user's context.
      
            Description of the web page:
            ${pageDescription}
      
            Component description:
            ${componentDescription}
            
            User's context:
            ${userContext}
      
            Output needs to follow one of the JSON formats in plain text. Never provide additional context.
            {
              reason: <the reason why you need to input certain content>,
              value: <the text that is most relevant for the given component>
            }
            OR
            {
              reason: <the reason why you cannot decide what content to input>,
              value: null
            }
          `,
  };
  return await getAiResponse([inputComponentPrompt]);
}

export async function makeQuestionForConfirmation(
  component: ParsingResult,
  actionValue: string
) {
  const makeConfirmationPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `
          You are the AI assistant who sees the abstraction of part of the user's web page. You have decided what to do for the given component abstraction on the web page based on the user's context
    
          Now you need to create a human natural language question to confirm the user's aim, without specifying which element to operate or using web terms. Don't assume general context; only refer to the given context. Don't mention the component in your question. Confirm the aim of the value.
    
          The description of the webpage:
          The purpose of the body HTML is to display the content of a webpage for Greyhound, a bus travel company.
    
          Action template:
          {
            "type":  <The definition of the given action>,
            "description": <The description of the specific action component>,
            "value": <(Optional) The value to be filled in the component>
          }
        `,
    },
    {
      role: "HUMAN",
      content: `
          {
            "type": ${component.action},
            "description": ${component.description},
            ${component.action === "click" ? "" : `"value": ${actionValue}`}
          }
        `,
    },
  ];
  const confirmation = await getAiResponse(makeConfirmationPrompts);
  return confirmation;
}

export async function getActionHistory(
  triedAction: string,
  actionType: string,
  actionValue: string
) {
  const actionHistoryPrompt: Prompt = {
    role: "SYSTEM",
    content: `Here are the actions that the system tried and have done on the web page. 

Tried: ${triedAction}
Done: ${actionType} '${actionValue}'

Describe the action on the web page in one sentence`,
  };
  return await getAiResponse([actionHistoryPrompt]);
}

export async function getSystemContext(
  actionHistory: string[],
  screenDescription: string,
  modalDescription?: string
) {
  const summarizePageDescriptionPrompt: Prompt = {
    role: "SYSTEM",
    content: `Summarize the description in a short sentence.

`,
  };
}
