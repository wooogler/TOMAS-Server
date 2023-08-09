import { Chat } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import { ActionType } from "./htmlHandler";
import { ActionComponent } from "./pageHandler";

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

const MAX_CHARACTERS_16K = 30000;

export const getAiResponse = async (prompts: Prompt[]) => {
  const promptMessages = prompts.map((prompt) => {
    const promptContent =
      prompt.content.slice(0, MAX_CHARACTERS_16K) +
      "... [Content trimmed due to token limits]";
    if (prompt.role === "HUMAN") {
      return new HumanChatMessage(promptContent);
    } else if (prompt.role === "AI") {
      return new AIChatMessage(promptContent);
    } else {
      return new SystemChatMessage(promptContent);
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

export const getPageDescription = async (html: string) => {
  const describePageSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the HTML code, briefly summarize the general purpose of the web page it represents in one sentence.
    
HTML code:
${html}`,
  };

  const pageDescription = await getAiResponse([describePageSystemPrompt]);

  return pageDescription;
};

export const getModalDescription = async (
  html: string,
  pageDescription: string
) => {
  const describeModalSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the HTML code, summarize the general purpose of the modal in the web page it represents.
    
Consider the description on the web page where the modal is located: ${pageDescription}

HTML code:
${html}`,
  };

  const screenDescription = await getAiResponse([describeModalSystemPrompt]);

  return screenDescription;
};

export const getSectionDescription = async (
  html: string,
  pageDescription: string
) => {
  const describeSectionSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the HTML code, summarize the general purpose of the section in the web page it represents.
    
Consider the description on the webpage where the section is located: ${pageDescription}

HTML code:
${html}`,
  };

  const sectionDescription = await getAiResponse([describeSectionSystemPrompt]);

  return sectionDescription;
};

export const makeConversationPrompt = (chats: Chat[]): Prompt => ({
  role: "HUMAN",
  content: `Conversation:
  ${chats
    .map(
      (chat) => `${chat.role === "HUMAN" ? "User" : "System"}: ${chat.content}`
    )
    .join("\n")}`,
});

export const getUserObjective = async (chats: Chat[]) => {
  const findTaskObjectiveSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You need to examine the conversation between user and system and determine the user's objective. Output the objective using "To ~" without providing additional context.`,
  };

  const conversationPrompt: Prompt = makeConversationPrompt(chats);

  return getAiResponse([findTaskObjectiveSystemPrompt, conversationPrompt]);
};

export interface ComponentInfo {
  context: string;
  action: {
    type: ActionType;
    description: string;
  };
  description: string;
}

const capitalizeFirstCharacter = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const editActionType = (actionType: ActionType) => {
  const action = actionType === "focus" ? "select" : actionType;
  const actionName = capitalizeFirstCharacter(action);
  return actionName;
};

export const getComponentInfo = async ({
  componentHtml,
  screenDescription,
  actionType,
}: {
  componentHtml: string;
  screenDescription: string;
  actionType: ActionType;
}) => {
  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are a web developer. You need to explain the context when the user interacts with a given HTML element and the action for the user to interact with the element.

Consider the description about where this element is located: ${screenDescription}

Output following JSON format in plain text. Never provide additional context.

{
  context : <the context when the user interacts with the element>,
  action: {
    type: ${editActionType(actionType)},
    description: <description of the action>
  },
  description: <describe the action based on the context starting with '${editActionType(
    actionType
  )} '>
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
  actionType: ActionType;
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
    type: ${editActionType(actionType)},
    description: <description of the action>
  },
  description: <describe the action based on the context starting with '${editActionType(
    actionType
  )} one'>
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
  const converationPrompt: Prompt = makeConversationPrompt(chats);
  const findUserContextPrompt: Prompt = {
    role: "SYSTEM",
    content: `Based on the conversation between the system and the user, describe the user's context. Please keep all useful information from the conversation in the context considering the user's goal.
`,
  };
  const userContext = await getAiResponse([
    findUserContextPrompt,
    converationPrompt,
  ]);
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
  component: ActionComponent,
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
            "type": ${component.actionType},
            "description": ${component.description},
            ${component.actionType === "click" ? "" : `"value": ${actionValue}`}
          }
        `,
    },
  ];
  const confirmation = await getAiResponse(makeConfirmationPrompts);
  return confirmation;
}

export async function getActionHistory(
  actionComponent: ActionComponent,
  actionValue: string
) {
  let actionDone = "";
  const actionType = actionComponent.actionType;
  if (actionType === "click") {
    if (actionValue === "yes") {
      actionDone = "Do Click";
    } else {
      actionDone = "Don't Click";
    }
  } else {
    actionDone = actionValue;
  }
  const actionHistoryPrompt: Prompt = {
    role: "SYSTEM",
    content: `Here are the actions that the system tried and have done on the web page. 

Tried: ${actionComponent.description}
Done: ${
      actionType === "click"
        ? `${actionDone}`
        : `${editActionType(actionType)} '${actionDone}'`
    }

Describe the action on the web page in one sentence`,
  };
  return await getAiResponse([actionHistoryPrompt]);
}

// Include all description for page, modal, section, and action.
export interface SystemLog {
  id: string;
  type: "page" | "modal" | "section" | "action";
  screenDescription: string;
  actionDescription: string;
}

export async function getSystemContext(systemLogs: SystemLog[]) {
  let actionHistory: {
    type: "page" | "modal" | "section" | "action";
    description: string;
  }[] = [];
  let prevId = "";
  systemLogs.forEach((log) => {
    if (prevId !== log.id) {
      // Action in new screen
      actionHistory.push({
        type: log.type,
        description: log.screenDescription,
      });
      actionHistory.push({
        type: "action",
        description: log.actionDescription,
      });
      prevId = log.id;
    } else {
      // Action in prev screen
      actionHistory.push({
        type: "action",
        description: log.actionDescription,
      });
    }
  });
  console.log(actionHistory);

  const makeSystemContextPrompt: Prompt = {
    role: "SYSTEM",
    content: `Based on the history of the system's actions, please describe the actions the system have done in natural language.

Action History:
${actionHistory.map((item) => {
  if (item.type === "action") {
    return ` - ${item.description}\n`;
  } else {
    return `In ${item.type}: ${item.description}\n`;
  }
})}
`,
  };
  console.log(makeSystemContextPrompt.content);

  const systemContext = await getAiResponse([makeSystemContextPrompt]);
  return systemContext;
}
