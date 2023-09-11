import { parsingItemAgent } from "../modules/agents";
import {
  ActionType,
  editActionType,
  extractSurroundingHtml,
  removeBeforeAndIncludingKeyword,
} from "../utils/htmlHandler";
import { Prompt, getAiResponse } from "../utils/langchainHandler";

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
    content: `Don't mention the value in the element to describe the action. Don't apologize.`,
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
  screenDescription,
}: {
  componentHtml: string;
  screenHtml: string;
  screenDescription: string;
}) => {
  const components = await parsingItemAgent({
    screenHtml: componentHtml,
    screenDescription,
  });

  let extractComponentSystemPrompt: Prompt;

  if (components.length === 0) {
    return null;
  }

  if (components[0].actionType === "click") {
    extractComponentSystemPrompt = {
      role: "SYSTEM",
      content: `Describe the action the user can take on the section in one sentence, starting with 'Select one '

HTML code of the section:
${componentHtml}

Description of the screen where the element is located:
${screenDescription}

HTML code of the screen:
${extractSurroundingHtml(screenHtml, componentHtml)}`,
    };
  } else {
    const listString = components
      .map((component) => `- ${component.description}`)
      .join("\n");

    extractComponentSystemPrompt = {
      role: "SYSTEM",
      content: `Here is information of an list on the screen.      

Items in the list:
${listString} 

Description of the screen where the list is located:
${screenDescription}

Infer the purpose of the list and describe the action of a user selecting one item from that list in one sentence, starting with 'Select one '.`,
    };

    console.log(extractComponentSystemPrompt.content);
  }

  const componentDescription = await getAiResponse([
    extractComponentSystemPrompt,
  ]);
  return componentDescription;
};

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
