import { Action, Chat } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import { ActionType, parsingItemAgent } from "./htmlHandler";
import { ActionComponent, ScreenResult } from "./pageHandler";

export type Prompt = {
  role: "SYSTEM" | "HUMAN" | "AI";
  content: string;
};

const chat = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo",
  maxTokens: -1,
  temperature: 0,
});

const chat16k = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo-16k",
  maxTokens: -1,
  temperature: 0,
});

const chat4 = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4",
  temperature: 0.2,
  maxTokens: 4096,
});

const MAX_CHARACTERS_16K = 30000;

export const getAiResponse = async (
  prompts: Prompt[],
  long: boolean = true
) => {
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

  let chatModel = long ? chat16k : chat;
  const response = await chatModel.call(promptMessages);

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
    content: `Summarize the purpose of the section.

HTML of the section:
${html}
    
The description on the webpage where the section is located: ${pageDescription}
`,
  };

  const sectionDescription = await getAiResponse([describeSectionSystemPrompt]);

  return sectionDescription;
};

export const getListDescription = async (
  html: string,
  pageDescription: string
) => {
  const describeListSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Summarize the purpose of the list.

HTML of the list:
${html}
    
The description on the webpage where the list is located: ${pageDescription}
`,
  };

  const listDescription = await getAiResponse([describeListSystemPrompt]);

  return listDescription;
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

export const editActionType = (actionType: ActionType) => {
  const action = actionType === "focus" ? "select" : actionType;
  const actionName = capitalizeFirstCharacter(action);
  return actionName;
};

export const getComponentInfoOriginal = async ({
  componentHtml,
  screenHtml,
  actionType,
  screenDescription,
}: {
  componentHtml: string;
  screenHtml: string;
  actionType: ActionType;
  screenDescription: string;
}) => {
  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are a web developer. You need to explain the context when the user interacts with a given HTML element and the action for the user to interact with the element.

This is the HTML code of the screen: ${screenDescription}
${screenHtml}

This is the HTML code of the element. ${
      actionType !== "select" ? "Ignore value or state of the element." : ""
    }
${componentHtml}

Output following JSON format in plain text. Never provide additional context.

{
  context : <the context when the user interacts with the element>,
  action: {
    type: ${editActionType(actionType)},
    description: <description of the action>
  },
  description: <describe the action based on the context starting with '${editActionType(
    actionType
  )}'>
}`,
  };

  try {
    const componentJson = await getAiResponse([extractComponentSystemPrompt]);
    const componentObj = JSON.parse(componentJson);
    return componentObj as ComponentInfo;
  } catch (error) {
    console.error("Error parsing JSON:", error);
  }
};

function extractSurroundingHtml(
  htmlString: string,
  target: string,
  range = 1000
) {
  const startIndex = htmlString.indexOf(target);
  if (startIndex === -1) {
    return null;
  }

  const endIndex = startIndex + target.length;

  const beforeTarget = htmlString.substring(
    Math.max(0, startIndex - range),
    startIndex
  );

  const afterTarget = htmlString.substring(endIndex, endIndex + range);

  return "..." + beforeTarget + target + afterTarget + "...";
}

export const getComponentInfo = async ({
  componentHtml,
  screenHtml,
  actionType,
  screenDescription,
}: {
  componentHtml: string;
  screenHtml: string;
  actionType: ActionType;
  screenDescription: string;
}) => {
  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Describe the action that the user can take with its purpose, starting with '${editActionType(
      actionType
    )} ' in a sentence.

HTML of the element:
${componentHtml}

Description of the screen where the element is located:
${screenDescription}

Surrounding HTML of the element:
${extractSurroundingHtml(screenHtml, componentHtml)}
`,
  };
  // console.log(extractComponentSystemPrompt.content);

  try {
    const componentDescription = await getAiResponse([
      extractComponentSystemPrompt,
    ]);
    // const componentObj = JSON.parse(componentJson);
    return {
      context: "",
      action: {
        type: actionType,
        description: "",
      },
      description: componentDescription,
    } as ComponentInfo;
  } catch (error) {
    console.error("Error parsing JSON:", error);
  }
};

export const getSelectInfoOriginal = async ({
  componentHtml,
  screenHtml,
  actionType,
  screenDescription,
}: {
  componentHtml: string;
  screenHtml: string;
  actionType: ActionType;
  screenDescription: string;
}) => {
  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
A user will select one item from the given list in the current screen and observe it closely.

Describe the action the user can take, starting with '${editActionType(
      actionType
    )} one'

This is the description of the screen where the element is located:
${screenDescription}

This is the HTML code of the screen:
${screenHtml}

This is the HTML code of the list:
${componentHtml}`,
  };

  try {
    const componentDescription = await getAiResponse([
      extractComponentSystemPrompt,
    ]);
    return {
      context: "",
      action: {
        type: actionType,
        description: "",
      },
      description: componentDescription,
    } as ComponentInfo;
  } catch (error) {
    console.error("Error parsing JSON:", error);
  }
};

export const getSelectInfo = async ({
  componentHtml,
  screenHtml,
  actionType,
  screenDescription,
}: {
  componentHtml: string;
  screenHtml: string;
  actionType: ActionType;
  screenDescription: string;
}) => {
  const components = await parsingItemAgent({
    screenHtml: componentHtml,
    screenDescription,
  });

  const listString = components
    .map(
      (component) => `- ${component.description?.split(" ").slice(1).join(" ")}`
    )
    .join("\n");

  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Describe the action the user can take in one single sentence, starting with '${editActionType(
      actionType
    )} one'

List in the screen:
${listString}

The description of the screen where the element is located:
${screenDescription}`,
  };

  try {
    const componentDescription = await getAiResponse([
      extractComponentSystemPrompt,
    ]);
    return {
      context: "",
      action: {
        type: actionType,
        description: "",
      },
      description: componentDescription,
    } as ComponentInfo;
  } catch (error) {
    console.error("Error parsing JSON:", error);
  }
};

function removeBeforeAndIncludingRepresents(sentence: string): string {
  const keyword = "It is ";
  const index = sentence.indexOf(keyword);

  if (index !== -1) {
    return sentence.substring(index + keyword.length);
  }
  return sentence; // 만약 "represents"가 문장에 없다면 원래 문장을 반환
}

export const getSimpleItemDescription = async ({
  itemHtml,
  screenHtml,
  screenDescription,
  prevDescription,
}: {
  itemHtml: string;
  screenHtml: string;
  screenDescription: string;
  prevDescription?: string;
}) => {
  const describeItemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
Summarize an item in the list in one sentence starting "It is " ${
      prevDescription
        ? ` with reference to the previous item's description`
        : ""
    }
${prevDescription ? `Previous description: ${prevDescription}` : ""}

HTML of the item:
${itemHtml}

Description of the list:
${screenDescription}
`,
  };

  try {
    return removeBeforeAndIncludingRepresents(
      await getAiResponse([describeItemPrompt])
    );
  } catch (error) {
    console.error("Error in loading item info: ", error);
  }
};

export const getComplexItemDescription = async ({
  itemHtml,
  screenHtml,
  screenDescription,
  prevDescription,
}: {
  itemHtml: string;
  screenHtml: string;
  screenDescription: string;
  prevDescription?: string;
}) => {
  const describeItemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
Describe an item in the list in one sentence starting "It is " ${
      prevDescription
        ? ` with reference to the previous item's description`
        : ""
    }. The description must include all the information in the item.
${prevDescription ? `Previous description: ${prevDescription}` : ""}

HTML of the item:
${itemHtml}

Description of the list:
${screenDescription}
`,
  };

  try {
    return removeBeforeAndIncludingRepresents(
      await getAiResponse([describeItemPrompt])
    );
  } catch (error) {
    console.error("Error in loading item info: ", error);
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
    content: `Based on the conversation between the system and the user, describe the user's context. Please keep all useful information from the conversation in the context considering the user's goal. Start with "User's Context: "`,
  };
  const userContext = await getAiResponse([
    findUserContextPrompt,
    converationPrompt,
  ]);
  return userContext;
}

export async function makeQuestionForActionValue(
  screenDescription: string,
  componentDescription: string | undefined
) {
  const makeQuestionPrompt: Prompt = {
    role: "SYSTEM",
    content: `Create a natural language question to ask to the user before doing the given action on the screen.

Action: ${componentDescription}

The description of the screen:  ${screenDescription}

Please avoid the jargons, mechanical terms, and the terms that are too specific to the webpage.
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
  console.log("inputComponentPrompt: ", inputComponentPrompt.content);
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
  const response = await getAiResponse([inputComponentPrompt]);
  console.log(response);
  return response;
}

export async function makeQuestionForConfirmationOriginal(
  component: ActionComponent,
  actionValue: string,
  screenDescription: string
) {
  const makeConfirmationPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `
          You are the AI assistant who sees the abstraction of part of the user's web page. You have decided what to do for the given component abstraction on the web page based on the user's context
    
          Now you need to create a human natural language question to confirm the user's aim, without specifying which element to operate or using web terms. Don't assume general context; only refer to the given context. Don't mention the component in your question. Confirm the aim of the value.
    
          The description of the webpage:
          ${screenDescription}
    
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

function replaceClickWithSelect(sentence: string) {
  if (sentence.startsWith("Click ")) {
    return "Select" + sentence.slice(5);
  }
  return sentence;
}

export async function makeQuestionForConfirmation2(
  component: ActionComponent,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `
You are looking at a webpage.
The description of the webpage:  ${screenDescription}
    
You need to create a natural language question to ask the user to confirm whether they will do the given action${
        component.actionType === "input" ? " and value" : ""
      }.

The user cannot see the webpage, so please do not mention any details about the webpage or the component.

Action: ${replaceClickWithSelect(component.description || "")}
${component.actionType === "input" ? `Value: ${actionValue}` : ""}

Please avoid the jargons, mechanical terms, and the terms that are too specific to the webpage.`,
    },
  ];

  const confirmation = await getAiResponse(makeConfirmationPrompts);
  return confirmation;
}

export async function makeQuestionForConfirmation(
  component: ActionComponent,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `Create a concise natural language question to ask whether the user wants to do the given action${
        component.actionType === "input" ? " with value" : ""
      }, without the action.

Action: ${replaceClickWithSelect(component.description || "")}
${component.actionType === "input" ? `Value: ${actionValue}` : ""}

The description of the screen:  ${screenDescription}

Please avoid the jargons, mechanical terms, and the terms that are specific to the webpage.`,
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
      actionDone = "Do click";
    } else {
      actionDone = "Don't click";
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
  // console.log(actionHistory);

  //   const makeSystemContextPrompt: Prompt = {
  //     role: "SYSTEM",
  //     content: `Based on the history of the system's actions, please describe the actions the system have done in natural language.

  // Action History:
  // ${actionHistory.map((item) => {
  //   if (item.type !== "action") {
  //     return `In ${item.type}: ${item.description}\n`;
  //   } else {
  //     return ` - ${item.description}\n`;
  //   }
  // })}
  // `,
  //   };
  //   console.log(makeSystemContextPrompt.content);

  //   const systemContext = await getAiResponse([makeSystemContextPrompt]);

  const systemContext = actionHistory
    .map((item) => {
      if (item.type !== "action") {
        return `In the ${item.type}: ${item.description}`;
      } else {
        return ` - ${item.description}`;
      }
    })
    .join("\n");
  return systemContext;
}

export async function getUsefulAttrFromList(selectResult: ScreenResult) {
  const optionList = selectResult.actionComponents
    .map((item) => {
      return `"i": ${item.i}, "description": ${item.description}, "html": ${item.html}`;
    })
    .join("\n");
  const makeListPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `
              You are the AI assistant who sees a list of items in webpage. For each item, there's a description and full html.
              As a database developer, we want to create a table for those items to keep all useful information for user, and help user to select from those items.
              Please help us to choose which attributes to keep.
              Remember, our ultimate goal is to help the user to make their decision from those options based on the attribute we keep. 
              The description of the webpage:${selectResult.screenDescription}
              The output should be like:
- <attr1>
- <attr2>
- ...

               Please do not include any other information in the output.
              
            `,
    },
    {
      role: "HUMAN",
      content: `
              options: ${optionList}
            `,
    },
  ];
  const confirmation = await getAiResponse(makeListPrompts);
  const array = confirmation
    .split("\n")
    .filter((item) => item.startsWith("-"))
    .map((item) => item.replace(/^- */, "").trim());
  return array;
}

export async function getListFromSelectResult(
  option: ActionComponent,
  screenDescription: string,
  attrList: string[]
) {
  const makeListPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `
            You are the AI assistant who sees an option in a list from webpage. For this option, there's a description and full html.
      
            Please find all value of corresponding attributes in attribute list for this option.

            The attrList is: ${attrList.map((item) => `"${item}"`).join(", ")}

            Output your result in JSON format.

            The json should be in the following format:
            {
                <attr1>: <value1>,
                <attr2>: <value2>,
                ...
            }

            The description of the webpage:
            ${screenDescription}
          `,
    },
    {
      role: "HUMAN",
      content: `
            option html: ${option.html}
            option description: ${option.description}
          `,
    },
  ];
  const confirmation = await getAiResponse(makeListPrompts);
  return confirmation;
}
