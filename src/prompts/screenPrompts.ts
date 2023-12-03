import { ScreenCache } from "../utils/fileUtil";
import {
  ActionType,
  capitalizeFirstCharacter,
  editActionType,
  extractSurroundingHtml,
  generateIdentifier,
  removeBeforeAndIncludingKeyword,
  simplifyHtml,
} from "../utils/htmlHandler";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { ScreenType } from "../utils/pageHandler";
import { makeSectionDescriptionPrompt } from "./chatPrompts";

export const getScreenDescription = async (
  screenHtml: string,
  screenType: ScreenType
) => {
  const screenCache = new ScreenCache("screenCache.json");
  const screenIdentifier = generateIdentifier(screenHtml) + "-" + screenType;
  const screen = screenCache.get(screenIdentifier);
  if (screen) {
    return screen;
  }

  const html = simplifyHtml(screenHtml, true, false);

  let describeScreenSystemPrompt: Prompt;

  if (screenType === "page") {
    describeScreenSystemPrompt = {
      role: "SYSTEM",
      content: `Analyze the provided HTML code of the webpage and describe the page's specific purpose and function in one sentence. Focus on the type of information the webpage is designed to convey and its intended use, based on the structure and elements found in the HTML.
      
HTML code of the page:
${html}`,
    };
  } else if (screenType === "modal") {
    // screenType === 'modal'
    describeScreenSystemPrompt = {
      role: "SYSTEM",
      content: `Analyze the provided HTML code of the modal and describe the modal's specific purpose and function in one sentence. Focus on the type of information or interaction the modal is designed to convey or facilitate, based on its structure and elements.
      
HTML code of the modal:
${html}`,
    };
  } else {
    // screenType === 'section'
    describeScreenSystemPrompt = {
      role: "SYSTEM",
      content: `Analyze the provided HTML code of the section and describe the section's specific purpose and function in one sentence.
      
HTML code of the section:
${html}`,
    };
  }

  const describePageInKoreanPrompt: Prompt = {
    role: "HUMAN",
    content: `Describe the main purpose of the described screen in one Korean sentence, focusing on its function and the type of information it provides, without detailing the specific elements or layout of the screen.`,
  };

  const screenDescription = await getGpt4Response(
    [describeScreenSystemPrompt],
    true
  );
  const screenDescriptionKorean = await getGpt4Response([
    describeScreenSystemPrompt,
    { content: screenDescription, role: "AI" },
    describePageInKoreanPrompt,
  ]);

  screenCache.set(screenIdentifier, {
    type: screenType,
    screenDescription,
    screenDescriptionKorean,
  });
  screenCache.save();

  return { screenDescription, screenDescriptionKorean };
};

export const getSectionState = async (screen: string) => {
  const html = simplifyHtml(screen, true, true);
  const describeSectionStatePrompt: Prompt = {
    role: "SYSTEM",
    content: `Analyze the provided HTML code and return the current state of the section in a JSON format. 
Focus on extracting values from key elements like input fields and buttons to construct a structured representation of the section's state.

HTML code of the section:
${html}`,
  };

  const sectionState = await getAiResponse([describeSectionStatePrompt], true);

  return { sectionState };
};

export const getSectionLongState = async (screen: string) => {
  const html = simplifyHtml(screen, true, true);
  const describeSectionStatePrompt: Prompt = {
    role: "SYSTEM",
    content: `Analyze the provided HTML code and describe the current state of the section in natural language. Focus specifically on elements with distinctive classes that indicate their state, such as 'active', 'selected', 'disabled', etc. Describe how these classes reflect the current configuration and status of the section's key elements like buttons, input fields, and other interactive components.

HTML code of the section:
${html}`,
  };

  const sectionState = await getGpt4Response([describeSectionStatePrompt]);

  return { sectionState };
};

export const getSectionDescription = async (
  sectionHtml: string,
  screenDescription: string
) => {
  const screenCache = new ScreenCache("screenCache.json");
  const screenIdentifier = generateIdentifier(sectionHtml) + "-section";
  const screen = screenCache.get(screenIdentifier);
  if (screen) {
    return {
      sectionDescription: screen.screenDescription,
      sectionDescriptionKorean: screen.screenDescriptionKorean,
    };
  }

  const html = simplifyHtml(sectionHtml, true, true);

  const describeSectionSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Analyze the provided HTML code of the section and describe the section's specific purpose and function in one sentence. 
    
Consider the description on the screen where the section is located: ${screenDescription}

HTML code:
${html}`,
  };

  const sectionDescription = await getGpt4Response(
    [describeSectionSystemPrompt],
    true
  );
  const sectionDescriptionKorean = await getGpt4Response([
    describeSectionSystemPrompt,
    {
      content: sectionDescription,
      role: "AI",
    },
    makeSectionDescriptionPrompt(),
  ]);

  screenCache.set(screenIdentifier, {
    type: "section",
    screenDescription: sectionDescription,
    screenDescriptionKorean: sectionDescriptionKorean,
  });
  screenCache.save();

  return { sectionDescription, sectionDescriptionKorean };
};

export const getListDescription = async (
  listHtml: string,
  screenDescription: string
) => {
  const screenCache = new ScreenCache("screenCache.json");
  const screenIdentifier = generateIdentifier(listHtml) + "-list";
  const screen = screenCache.get(screenIdentifier);
  if (screen) {
    return {
      listDescription: screen.screenDescription,
      listDescriptionKorean: screen.screenDescriptionKorean,
    };
  }
  const html = simplifyHtml(listHtml, true, true);

  const describeListSystemPrompt: Prompt = {
    role: "SYSTEM",
    content: `Analyze the provided HTML code of the list and summarize its general purpose in one sentence. Focus on the type of information the list is designed to display and its intended use, based on the elements and structure found in the HTML. Avoid detailing the specific layout or design of the list's elements, but use the HTML to deduce the overall purpose of the list and the nature of the information it contains.

HTML of the list:
${html}

Description of the screen where the list is Located:
${screenDescription}
`,
  };

  const listDescription = await getGpt4Response(
    [describeListSystemPrompt],
    true
  );
  const listDescriptionKorean = await getGpt4Response([
    describeListSystemPrompt,
    { content: listDescription, role: "AI" },
    makeSectionDescriptionPrompt(),
  ]);

  screenCache.set(screenIdentifier, {
    type: "list",
    screenDescription: listDescription,
    screenDescriptionKorean: listDescriptionKorean,
  });
  screenCache.save();

  return { listDescription, listDescriptionKorean };
};

export const selectActionTemplateOriginal = ({
  options,
  firstThreeItemsWithParentHtml,
  screenDescription,
}: {
  options: string[];
  firstThreeItemsWithParentHtml: string;
  screenDescription: string;
}): Prompt => ({
  role: "SYSTEM",
  content: `Analyze the role of an group on the web page, considering both the types of items it displays and user interaction, as well as any comments within the group's HTML context. 
Output a concise, one-sentence description starting with 'Select one '.
Your sentence should succinctly encapsulate the purpose of selecting an item and the action involved. 
Rely on the provided items, HTML context of the group, and screen description to accurately identify the types of items and ensure your description is brief yet comprehensive.
Avoid mentioning javascript functions.

Text on the items:
${options.map((option) => `- ${option}`).join("\n")}

HTML of the first three items:
${simplifyHtml(firstThreeItemsWithParentHtml, true, true)}

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

export const selectActionTemplate = ({
  screenDescription,
  simplifiedElementHtml,
  simplifiedScreenHtml,
}: {
  screenDescription: string;
  simplifiedElementHtml: string;
  simplifiedScreenHtml: string;
}): Prompt => {
  return {
    role: "SYSTEM",
    content: `Provide a detailed analysis of the action that select one item in a HTML element on the screen, starting your description with 'Select one '. 
Explain the purpose of this action referring to the element and its surrounding interface. 
Your description should be in the form of a directive, instructing a specific action to be performed, in one concise sentence.
Avoid mentioning examples and javascript functions in the output.

HTML of the Element:
${simplifiedElementHtml}

Surrounding HTML of the Element:
${extractSurroundingHtml(simplifiedScreenHtml, simplifiedElementHtml)}

Screen Context Description:
${screenDescription}
`,
  };
};

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
}): Prompt => {
  if (actionType === "modify") {
    return {
      role: "SYSTEM",
      content: `Given the HTML element on the screen, analyze the structure and identify the main function. Describe the action on the element in one sentence, starting with 'Select '. 
    
    HTML of the Element:
    ${simplifiedElementHtml}
    
    Screen Context Description:
    ${screenDescription}
    `,
    };
  } else {
    return {
      role: "SYSTEM",
      content: `Provide a detailed analysis of the action with an HTML element in its screen context, starting your description with '${capitalizeFirstCharacter(
        actionType
      )} the [element]'. 
Explain the purpose of this action referring to the element and its surrounding interface. 
Your description should be in the form of a directive, instructing a specific action to be performed, in one concise sentence.
Avoid mentioning javascript functions.

HTML of the Element:
${simplifiedElementHtml}

Surrounding HTML of the Element:
${extractSurroundingHtml(simplifiedScreenHtml, simplifiedElementHtml)}

Screen Context Description:
${screenDescription}
`,
    };
  }
};
