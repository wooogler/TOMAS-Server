import { Chat } from "@prisma/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";
import { ActionType, parsingItemAgent, simplifyItemHtml } from "./htmlHandler";
import { ActionComponent, ScreenResult } from "./pageHandler";
import { JSDOM } from "jsdom";

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

const MAX_CHARACTERS = 30000;

export const getAiResponse = async (
  prompts: Prompt[],
  long: boolean = true
) => {
  const promptMessages = prompts.map((prompt) => {
    const promptContent = prompt.content.slice(0, MAX_CHARACTERS) + "...";
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
  // const action = actionType === "focus" ? "select" : actionType;
  const actionName = capitalizeFirstCharacter(actionType);
  return actionName;
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
    content: `An user is looking at the web page screen. 

Describe the action that the user can take on the given element with its purpose, starting with '${editActionType(
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

  const firstActionPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([extractComponentSystemPrompt]),
  };

  // const modifyActionPrompt: Prompt = {
  //   role: "HUMAN",
  //   content: `Don't use the default value inside elements for the action and remove its attributes to identify each element. For example, 'Click the button to ' is allowed, but 'Click the "Change" button with/labeled ~' is not allowed.`,
  // };

  const modifyActionPrompt: Prompt = {
    role: "HUMAN",
    content: `Don't refer to the default value inside elements to describe the action.`,
  };

  // const modifyActionPrompt: Prompt = {
  //   role: "HUMAN",
  //   content: `Remove descriptions of the element's features within the action`,
  // };

  const componentDescription = await getAiResponse([
    extractComponentSystemPrompt,
    firstActionPrompt,
    modifyActionPrompt,
  ]);

  return componentDescription;
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
    .map((component) => `- ${component.description}`)
    .join("\n");

  const extractComponentSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Describe the action the user can take, starting with "Select one ".

UI Elements on the screen:
${listString}

The description of the screen where the elements are located:
${screenDescription}`,
  };

  console.log(extractComponentSystemPrompt.content);

  const firstActionPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([extractComponentSystemPrompt]),
  };

  const modifyActionPrompt: Prompt = {
    role: "HUMAN",
    content: `Don't use the default value inside the element to describe the action because the user can change its value.`,
  };

  const componentDescription = await getAiResponse([
    extractComponentSystemPrompt,
    // firstActionPrompt,
    // modifyActionPrompt,
  ]);
  return componentDescription;
};

function removeBeforeAndIncludingKeyword(sentence: string): string {
  const keyword = "It is ";
  const index = sentence.indexOf(keyword);

  if (index !== -1) {
    return sentence.substring(index + keyword.length);
  }
  return sentence; // 만약 "represents"가 문장에 없다면 원래 문장을 반환
}

export const getItemDescription = async ({
  itemHtml,
  screenHtml,
  screenDescription,
}: {
  itemHtml: string;
  screenHtml: string;
  screenDescription: string;
}) => {
  const describeItemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
Describe an item in the list in one sentence starting "It is ". The description must include all the information in the item.

HTML of the item:
${itemHtml}

Description of the list:
${screenDescription}
`,
  };

  try {
    return removeBeforeAndIncludingKeyword(
      await getAiResponse([describeItemPrompt])
    );
  } catch (error) {
    console.error("Error in loading item info: ", error);
  }
};

export const getPartDescription = async ({
  itemHtml,
  screenHtml,
  screenDescription,
}: {
  itemHtml: string;
  screenHtml: string;
  screenDescription: string;
}) => {
  const describeItemPrompt: Prompt = {
    role: "SYSTEM",
    content: `
Describe the part of the screen in one sentence starting "It is ". 

HTML of the part of webpage:
${itemHtml}

Description of the section where the item is located:
${screenDescription}
`,
  };

  try {
    return removeBeforeAndIncludingKeyword(
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

The description of the screen: ${screenDescription}
`,
  };

  const firstQuestionPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([makeQuestionPrompt]),
  };

  const modifyQuestionPrompt: Prompt = {
    role: "HUMAN",
    content:
      "The user does not see the screen and is unfamiliar with technology, so please do not mention the element and the action on the screen, and avoid the jargon, mechanical terms, and terms that are too specific to the webpage.",
  };

  return await getAiResponse([
    makeQuestionPrompt,
    firstQuestionPrompt,
    modifyQuestionPrompt,
  ]);
}

function replaceClickWithSelect(sentence: string) {
  if (sentence.startsWith("Click ")) {
    return "Select" + sentence.slice(5);
  }
  return sentence;
}

export async function makeQuestionForConfirmation(
  component: ActionComponent,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompt: Prompt = {
    role: "SYSTEM",
    content: `Create a natural language question to ask whether the user wants to do the given action${
      component.actionType === "input" ? " with value" : ""
    }.

Action: ${replaceClickWithSelect(component.description || "")}
${component.actionType === "input" ? `Value: ${actionValue}` : ""}

The description of the screen: ${screenDescription}`,
  };

  const firstConfirmationPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([makeConfirmationPrompt]),
  };

  const modifyConfirmationPrompt: Prompt = {
    role: "HUMAN",
    content:
      "The user does not see the screen and is unfamiliar with technology, so please do not mention the element and the action on the screen, and avoid the jargon, mechanical terms, and terms that are too specific to the webpage.",
  };

  return await getAiResponse([
    makeConfirmationPrompt,
    firstConfirmationPrompt,
    modifyConfirmationPrompt,
  ]);
}

export async function makeQuestionForSelectConfirmation(
  componentDescription: string,
  screenDescription: string,
  actionValue?: string
) {
  const makeConfirmationPrompt: Prompt = {
    role: "SYSTEM",
    content: `Create a natural language question to ask whether the user wants to do the given action with value

Action: Select ${componentDescription}
Value: ${actionValue}

The description of the screen: ${screenDescription}`,
  };

  const firstConfirmationPrompt: Prompt = {
    role: "AI",
    content: await getAiResponse([makeConfirmationPrompt]),
  };

  const modifyConfirmationPrompt: Prompt = {
    role: "HUMAN",
    content:
      "The user does not see the screen and is unfamiliar with technology, so please do not mention the element and the action on the screen, and avoid the jargon, mechanical terms, and terms that are too specific to the webpage.",
  };

  return await getAiResponse([
    makeConfirmationPrompt,
    firstConfirmationPrompt,
    modifyConfirmationPrompt,
  ]);
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

export async function getUsefulAttrFromList(
  actionComponents: ActionComponent[],
  screenDescription: string
) {
  const optionList = actionComponents
    .map((item) => {
      return `"i": ${item.i}, "description": ${item.description}, "html": ${item.html}`;
    })
    .join("\n");
  const makeListPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `You are the AI assistant who sees a list of items in webpage. For each item, there's a description and full html.
As a database developer, we want to create a table for those items to keep all useful information in html for user, and help user to select from those items.
Please help us to choose which attributes to keep.
Remember, our ultimate goal is to help the user to make their decision from those options based on the attribute we keep. 
Only keep the name of attributes. You do not have to keep an example of the attribute value.
The description of the webpage:${screenDescription}
The output should be like:
- <attr1>
- <attr2>
- ...

Please do not include any other information in the output.`,
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

async function getAttrValueFromItem(
  longComponent: ActionComponent,
  screenDescription: string
) {
  const simpleItemHtml = simplifyItemHtml(longComponent.html);

  const makeListPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `Extract all useful information the users can see on the web browser for them to select the item they want. 

Description of the section where the list is located:
${screenDescription}

HTML of one item in the list:
${simpleItemHtml}

Output the attributes and values in the following JSON format:

{
  <Attribute 1>: <value 1>,
  <Attribute 2>: <value 2>,
  ...
}

Please do not include any other information in the output.`,
    },
  ];

  console.log(makeListPrompts[0].content);

  const attrValue = await getGpt4Response(makeListPrompts);
  console.log(attrValue);
  return attrValue;
}

export async function getDataFromHTML(screen: ScreenResult) {
  const { actionComponents, screenDescription } = screen;

  const longComponent = actionComponents.reduce((longestItem, current) => {
    return current.html.length > longestItem.html.length
      ? current
      : longestItem;
  });

  const shortComponent = actionComponents.reduce((shortestItem, current) => {
    return current.html.length < shortestItem.html.length
      ? current
      : shortestItem;
  });

  const shortElement = new JSDOM(shortComponent.html).window.document.body;

  let results = [];

  if (
    (shortElement.textContent || "").length < 20 ||
    actionComponents.length > 5
  ) {
    results = actionComponents.map((comp) => comp.description);
  } else {
    const attrValue = await getAttrValueFromItem(
      longComponent,
      screenDescription
    );

    async function processComponent(component: ActionComponent) {
      const simpleItemHtml = simplifyItemHtml(component.html);
      const makeItemPrompts: Prompt[] = [
        {
          role: "SYSTEM",
          content: `Extract the information from the given HTML element using the same attribute with the example.
  
  Here is an example of another element in the same list.
  ${attrValue}
  
  HTML of the element:
  ${simpleItemHtml}
  
  Output the attributes and values in the following JSON format:
  
  {
    <attr1>: <val1>,
    <attr2>: <val2>,
    ...
  }
  
  Please do not include any other information in the output.
  `,
        },
      ];

      const jsonString = await getAiResponse(makeItemPrompts);
      const jsonObject = JSON.parse(jsonString);

      return jsonObject;
    }

    results = await Promise.all(actionComponents.map(processComponent));
  }

  const data = results.map((item, index) => {
    return {
      data: item,
      i: actionComponents[index].i,
      description: actionComponents[index].description,
      actionType: actionComponents[index].actionType,
    };
  });
  return data;
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
    "i": <value of i>,
    "description": <description>,
    <attr1>: <value1>,
    <attr2>: <value2>, 
    <attr3>: [<value3_1>, <value3_2>...]
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
  try {
    return JSON.parse(confirmation) as {
      i: string;
      description: string;
    } & Record<string, string | string[]>;
  } catch (error) {
    console.log("error in parsing json: ", error);
  }
}

export async function extractTextLabelFromHTML(
  itemHtml: string,
  screenDescription: string
) {
  const simpleItemHtml = simplifyItemHtml(itemHtml);

  const makeTextLabelPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `Generate the text label for the given HTML element.

Description of the section where the element is located:
${screenDescription}

HTML of the element:
${simpleItemHtml}`,
    },
  ];
  return await getAiResponse(makeTextLabelPrompts);
}
