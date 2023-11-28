import { parsingItemAgent } from "../modules/agents";
import {
  ActionType,
  capitalizeFirstCharacter,
  editActionType,
  extractSurroundingHtml,
  removeBeforeAndIncludingKeyword,
} from "../utils/htmlHandler";
import { Prompt, getAiResponse } from "../utils/langchainHandler";
import { ScreenType } from "../utils/pageHandler";
import { makeSectionDescriptionPrompt } from "./chatPrompts";

export const getScreenDescription = async (
  html: string,
  screenType: ScreenType
) => {
  let describeScreenSystemPrompt: Prompt;

  if (screenType === "page") {
    describeScreenSystemPrompt = {
      role: "SYSTEM",
      content: `Analyze the provided HTML code of the webpage and describe the page's general purpose and function in one sentence. Focus on the type of information the webpage is designed to convey and its intended use, based on the structure and elements found in the HTML.
      
HTML code of the page:
${html}`,
    };
  } else {
    // screenType === 'modal'
    describeScreenSystemPrompt = {
      role: "SYSTEM",
      content: `Analyze the provided HTML code of the modal and describe the modal's specific purpose and function in one sentence. Focus on the type of information or interaction the modal is designed to convey or facilitate, based on its structure and elements.
      
HTML code of the modal:
${html}`,
    };
  }

  const describePageInKoreanPrompt: Prompt = {
    role: "HUMAN",
    content: `Summarize the main purpose of the described screen in one Korean sentence, focusing on its function and the type of information it provides, without detailing the specific elements or layout of the screen.`,
  };

  const screenDescription = await getAiResponse([describeScreenSystemPrompt]);
  const screenDescriptionKorean = await getAiResponse([
    describeScreenSystemPrompt,
    { content: screenDescription, role: "AI" },
    describePageInKoreanPrompt,
  ]);

  return { screenDescription, screenDescriptionKorean };
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

export const getListDescription = async (
  html: string,
  screenDescription: string
) => {
  const describeListSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Analyze the provided HTML code of the list and summarize its general purpose in one sentence. Focus on the type of information the list is designed to display and its intended use, based on the elements and structure found in the HTML. Avoid detailing the specific layout or design of the list's elements, but use the HTML to deduce the overall purpose of the list and the nature of the information it contains.

HTML of the list:
${html}

Description of the screen where the list is Located:
${screenDescription}
`,
  };

  const listDescription = await getAiResponse([describeListSystemPrompt]);
  const listDescriptionKorean = await getAiResponse([
    describeListSystemPrompt,
    { content: listDescription, role: "AI" },
    makeSectionDescriptionPrompt(),
  ]);

  return { listDescription, listDescriptionKorean };
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
    content: `A user is looking at the web page screen. 

Describe the action that the user can take on the given element with its purpose, starting with '${editActionType(
      actionType
    )} ' in one sentence briefly.

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
    content: `Don't mention the attributes of the element to describe the action. Don't apologize.`,
  };

  // const modifyActionPrompt: Prompt = {
  //   role: "HUMAN",
  //   content: `Remove descriptions of the element's features within the action`,
  // };

  const componentDescription = await getAiResponse([
    extractComponentSystemPrompt,
    // firstActionPrompt,
    // modifyActionPrompt,
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

// export const selectActionTemplate = ({
//   options,
//   firstTwoItemsWithParentHtml,
//   screenDescription,
// }: {
//   options: string[];
//   firstTwoItemsWithParentHtml: string;
//   screenDescription: string;
// }): Prompt => ({
//   role: "SYSTEM",
//   content: `A user is looking at the list on the web page screen.

// HTML around the list with first two items:
// ${firstTwoItemsWithParentHtml}

// items'text in the list:
// ${options.map((option) => `- ${option}`).join("\n")}

// Description of the screen where the list is located:
// ${screenDescription}

// Infer the purpose of the list and describe the action of a user selecting one item from that list in one sentence, starting with 'Select one '.`,
// });

export const selectActionTemplate = ({
  options,
  firstThreeItemsWithParentHtml,
  screenDescription,
}: {
  options: string[];
  firstThreeItemsWithParentHtml: string;
  screenDescription: string;
}): Prompt => ({
  role: "SYSTEM",
  content: `Analyze the role of a list on the web page, focusing on the types of items it displays and user interaction. 
Output a concise, one-sentence description starting with 'Select one '.
Your sentence should succinctly encapsulate the purpose of selecting an item and the action involved. 
Rely on the provided list items, HTML context of the list, and screen description to accurately identify the types of items and ensure your description is brief yet comprehensive.

List items:
${options.map((option) => `- ${option}`).join("\n")}

HTML context of the list:
${firstThreeItemsWithParentHtml}

Screen Context Description:
${screenDescription}
`,
});

export const tableActionTemplate = ({
  screenDescription,
  simplifiedElementHtml,
  simplifiedScreenHtml,
}: {
  screenDescription: string;
  simplifiedElementHtml: string;
  simplifiedScreenHtml: string;
}): Prompt => ({
  role: "SYSTEM",
  content: `A user is looking at the table on the web page screen.

Description of the screen where the table is located:
${screenDescription}

HTML of the table:
${simplifiedElementHtml}

Surronding HTML of the table:
${extractSurroundingHtml(simplifiedScreenHtml, simplifiedElementHtml)}

Infer the purpose of the table and describe the action of a user selecting one item from that table in one sentence, starting with 'Select one '.`,
});

export const singleActionTemplate = ({
  actionType,
  screenDescription,
  simplifiedElementHtml,
  simplifiedScreenHtml,
}: {
  actionType: string;
  screenDescription: string;
  simplifiedElementHtml: string;
  simplifiedScreenHtml: string;
}): Prompt => ({
  role: "SYSTEM",
  content: `Provide a detailed analysis of the action with an HTML element in its screen context, starting your description with '${capitalizeFirstCharacter(
    actionType
  )} the [element]'. 
Explain the purpose of this action in relation to the element and its surrounding interface. 
Your description should be in the form of a directive, instructing a specific action to be performed, in one concise sentence.
Avoid mentioning javascript functions.

HTML of the Element:
${simplifiedElementHtml}

Surrounding HTML of the Element:
${extractSurroundingHtml(simplifiedScreenHtml, simplifiedElementHtml)}

Screen Context Description:
${screenDescription}
`,
});
