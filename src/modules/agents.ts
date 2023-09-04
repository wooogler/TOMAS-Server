import { JSDOM } from "jsdom";
import {
  ActionType,
  PossibleInteractions,
  comparePossibleInteractions,
  elementTextLength,
  parsingPossibleInteractions,
  simplifyHtml,
} from "../utils/htmlHandler";
import {
  ActionComponent,
  PageHandler,
  ScreenResult,
} from "../utils/pageHandler";
import { Prompt, getGpt4Response } from "../utils/langchainHandler";
import { getChats } from "./chat/chat.service";
import { createAIChat } from "./chat/chat.service";
import {
  SystemLog,
  findInputTextValue,
  getActionHistory,
} from "../prompts/actionPrompts";
import {
  getUserContext,
  makeQuestionForActionValue,
  makeQuestionForConfirmation,
} from "../prompts/chatPrompts";
import {
  getListDescription,
  getItemDescription,
  getPartDescription,
  getSelectInfo,
  getComponentInfo,
} from "../prompts/screenPrompts";
import { extractTextLabelFromHTML } from "../prompts/visualPrompts";

export interface TaskList {
  i: string;
  description: string;
}
export async function planningAgent(
  focusedSection: ScreenResult,
  userContext: string,
  systemContext: string
) {
  const planningActionPromptForSystem: Prompt = {
    role: "SYSTEM",
    content: `
You are the AI that creates a plan to interact with the main web page based on the user's and system's contexts.

Actions should be selected in order to achieve what the user wants based on the user's context. 
${userContext}

You need to plan the most efficient action sequence using the following possible actions in the part of the current screen. 
Description of the current screen: ${focusedSection.screenDescription}
Possible actions:
${focusedSection.actionComponents
  .map((comp) => `- ${comp.description} (i=${comp.i})`)
  .join("\n")}

The action plan should reflect the results of the interactions the system has executed before: 
${systemContext}

Please skip those actions that have been executed before and try different ways to achieve the user's objective.

First, describe the most efficient interaction plan in natural language by referring to the user's and system's contexts. Do not add any useless actions to the plan.

Then, return the plan as the list of actions as a numbered list in the format:

#. <First action> (i=<i>)
#. <Second action> (i=<i>)

The entries must be consecutively numbered, starting with 1. The number of each entry must be followed by a period.
Do not include any headers before your list or follow your list with any other output. No other information should be included in the output.

If you cannot find any actions to achieve the user's objective with possible actions in this part, return "No plans".
    `,
  };

  const planningActionPromptForUser: Prompt = {
    role: "HUMAN",
    content: `

    `,
  };
  console.log(`
---------------
Planning Agent:
---------------
`);
  console.log(planningActionPromptForSystem.content);
  console.log(planningActionPromptForUser.content);
  //   const response = await getAiResponse([
  //     planningActionPromptForSystem,
  //     planningActionPromptForUser,
  //   ]);
  const response = await getGpt4Response([
    planningActionPromptForSystem,
    // planningActionPromptForUser,
  ]);
  console.log(response);

  // Here we assume the response is in the format:
  // 1. <First action> (i=<i>)
  // 2. <Second action> (i=<i>)
  // ...
  const filter: RegExp = /^\d+\./;
  const tasks = response.split("\n").filter((line) => filter.test(line));
  const taskList: TaskList[] = [];
  for (const task of tasks) {
    const match = task.match(/(\d+)\. (.*) \(i=(\d+)\)/);
    if (match) {
      const i = match[3];
      const description = match[2];
      taskList.push({ i, description });
    }
  }

  // const firstItemI = extractFirstItemIValue(response);
  // if (firstItemI) {
  //   return components[firstItemI];
  // } else {
  //   throw new Error("No plans");
  // }

  return taskList;
}

export async function executionAgent(
  page: PageHandler,
  component: ActionComponent,
  //   chats: Chat[],
  screenDescription: string,
  currentFocusedSection: ScreenResult,
  systemLogs: SystemLog[]
) {
  console.log(`
---------------
Execution Agent:
---------------
`);

  let chats = await getChats();
  let userContext = await getUserContext(chats);
  let actionValue = "";
  if (component.actionType == "input") {
    let valueBasedOnHistory = await JSON.parse(
      await findInputTextValue(
        screenDescription,
        component.description,
        userContext
      )
    );
    if (valueBasedOnHistory.value == null) {
      const question = await makeQuestionForActionValue(
        screenDescription,
        component.description
      );

      // TODO: Ask the user the question, and get the answer. Then update chat history in the database.
      await createAIChat({ content: question });

      chats = await getChats();

      userContext = await getUserContext(chats);

      valueBasedOnHistory = await JSON.parse(
        await findInputTextValue(
          screenDescription,
          component.description,
          userContext
        )
      );
    }

    actionValue = valueBasedOnHistory.value;
  } else if (component.actionType == "select") {
    const options = await page.select(`[i="${component.i}"]`);
    createAIChat({
      content: `Which one do you want?
    Possible options could be:
    ${options.actionComponents.map(
      (action) => `- ${action.description}\n (i=${action.i}))\n\n`
    )}`,
    });

    // TODO: Wait for the user's answer. Then update chat history in the database.
    // suppose the answer is "<integer i>".
    actionValue = "352";
  }
  if (component.actionType != "select") {
    const confirmationQuestion = await makeQuestionForConfirmation(
      component,
      actionValue,
      screenDescription
    );
    // Add confirmation question to database. TODO: Get the answer.
    createAIChat({ content: confirmationQuestion });
  }

  // Suppose the answer is "yes"/"no".
  const answer = "yes";

  if (answer == "yes") {
    if (component.actionType == "input") {
      let rt = await page.inputText(`[i="${component.i}"]`, actionValue);
      return rt;
    } else if (component.actionType == "click") {
      const actionHistoryDescription = await getActionHistory(
        {
          i: component.i,
          actionType: "click",
          description: component.description,
          html: component.html,
        },
        "yes"
      );
      systemLogs.push({
        id: currentFocusedSection.id,
        type: "action",
        screenDescription: screenDescription,
        actionDescription: actionHistoryDescription,
      });

      return await page.click(`[i="${component.i}"]`);
    } else if (component.actionType == "select") {
      return await page.select(`[i="${actionValue}"]`);
    }
  }
  return currentFocusedSection;
  // TODO: Update task history or system context in the database.
}

type ProcessComponentParams = {
  comp: Element;
  screenHtml: string;
  listDescription: string;
  screenDescription: string;
};

async function processComponent({
  comp,
  screenHtml,
  listDescription,
  screenDescription,
}: ProcessComponentParams): Promise<ActionComponent[]> {
  const possibleInteractions = parsingPossibleInteractions(comp.outerHTML);

  if (!possibleInteractions.length) return [];

  if (possibleInteractions.length === 1) {
    const actionType = possibleInteractions[0].actionType;
    const tagName = possibleInteractions[0].tagName || "";
    const itemDescription = await getItemDescriptionBasedOnCriteria({
      comp,
      screenHtml,
      listDescription,
      screenDescription,
      tagName,
    });
    return [
      {
        i: possibleInteractions[0].i,
        actionType,
        description: itemDescription,
        html: comp.outerHTML,
      },
    ];
  }
  return await processMultipleInteractions({
    comp,
    screenHtml,
    listDescription,
    screenDescription,
    possibleInteractions,
  });
}

async function getItemDescriptionBasedOnCriteria({
  comp,
  screenHtml,
  listDescription,
  screenDescription,
  tagName,
}: ProcessComponentParams & { tagName: string }) {
  return elementTextLength(comp.outerHTML) < 30 || tagName === "table"
    ? await extractTextLabelFromHTML(comp.outerHTML, screenDescription)
    : await getItemDescription({
        itemHtml: comp.outerHTML,
        screenHtml,
        screenDescription: listDescription,
      });
}

async function processMultipleInteractions({
  comp,
  screenHtml,
  listDescription,
  screenDescription,
  possibleInteractions,
}: ProcessComponentParams & {
  possibleInteractions: PossibleInteractions[];
}): Promise<ActionComponent[]> {
  const partDescription = await getPartDescription({
    itemHtml: comp.outerHTML,
    screenHtml,
    screenDescription: listDescription,
  });

  if (possibleInteractions.length > 5) {
    return await parsingAgent({
      screenHtml: comp.innerHTML,
      screenDescription: partDescription || "",
    });
  }

  return [
    {
      i: comp.getAttribute("i") || "",
      actionType: "focus",
      description: partDescription,
      html: comp.outerHTML,
    },
  ];
}

export async function parsingItemAgent(params: {
  screenHtml: string;
  screenDescription: string;
  isFocus?: boolean;
}): Promise<ActionComponent[]> {
  const { screenHtml, screenDescription, isFocus = false } = params;
  const dom = new JSDOM(screenHtml);
  const listDescription = await getListDescription(
    screenHtml,
    screenDescription
  );

  if (isFocus)
    return await parsingAgent({
      screenHtml,
      screenDescription: listDescription,
    });

  const rootElement = dom.window.document.body.firstElementChild;
  if (!rootElement) return [];

  const components = Array.from(rootElement.children);
  const itemComponentsPromises = components.map((comp) =>
    processComponent({ comp, screenHtml, listDescription, screenDescription })
  );
  const itemComponents = await Promise.all(itemComponentsPromises);

  return itemComponents.flat();
}

export async function parsingAgent({
  screenHtml,
  screenDescription,
}: {
  screenHtml: string;
  screenDescription: string;
}): Promise<ActionComponent[]> {
  const possibleInteractions = parsingPossibleInteractions(screenHtml).sort(
    comparePossibleInteractions
  );

  const dom = new JSDOM(screenHtml);
  const body = dom.window.document.body;

  const actionComponentsPromises = possibleInteractions.map(
    async (interaction) => {
      const iAttr = interaction.i;
      const actionType = interaction.actionType;
      const componentHtml =
        body.querySelector(`[i="${iAttr}"]`)?.outerHTML || "";
      const componentDescription =
        actionType === "select"
          ? await getSelectInfo({
              componentHtml: simplifyHtml(componentHtml, false) || "",
              screenHtml: simplifyHtml(screenHtml, false),
              screenDescription,
            })
          : await getComponentInfo({
              componentHtml: simplifyHtml(componentHtml, false) || "",
              screenHtml: simplifyHtml(screenHtml, false),
              actionType: interaction.actionType,
              screenDescription,
            });

      if (componentDescription === null) {
        return null;
      }

      return {
        i: iAttr,
        actionType: interaction.actionType,
        description: componentDescription,
        html: componentHtml,
      };
    }
  );

  const actionComponents = await Promise.all(actionComponentsPromises);
  return actionComponents.filter((comp) => comp !== null) as ActionComponent[];
}
