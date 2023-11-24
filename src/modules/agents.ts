import { JSDOM } from "jsdom";
import {
  ActionType,
  PossibleInteractions,
  comparePossibleInteractions,
  elementTextLength,
  generateIdentifier,
  parsingPossibleInteractions,
  simplifyHtml,
} from "../utils/htmlHandler";
import {
  ActionComponent,
  PageHandler,
  ScreenResult,
} from "../utils/pageHandler";
import { Prompt, getGpt4Response } from "../utils/langchainHandler";
import { getChats, createAIChat } from "./chat/chat.service";
import {
  SystemLog,
  findInputTextValue,
  getActionHistory,
} from "../prompts/actionPrompts";
import {
  getUserGoal,
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
import { loadCacheFromFile, saveCacheToFile } from "../utils/fileUtil";
import { Action } from "../utils/parsingAgent";

export async function planningAgent(
  focusedSection: ScreenResult,
  userGoal: string,
  systemContext: string
) {
  const planningActionPromptForSystem: Prompt = {
    role: "SYSTEM",
    content: `You are an AI planning agent. Analyze the user's current goal and the available actions on the screen to determine the most logical and practical next step. Consider what a general user would likely find most useful or relevant in achieving their goal.

User Goal:
${userGoal}

Action Logs:
${systemContext}

Describe your thought process and reasoning for how to proceed, focusing on the most straightforward and beneficial action for the user, given the current screen context.

Then, from the available actions on the current screen, choose one next action with its corresponding "(i=##)" that is most likely to assist the user in a practical and effective manner.

Current Screen Description: ${focusedSection.screenDescription}

Available actions:
${focusedSection.actions
  .map((comp) => `- ${comp.content} (i=${comp.i})`)
  .join("\n")}
`,
  };
  console.log(`
---------------
Planning Agent:
---------------
`);
  console.log(planningActionPromptForSystem.content);
  //   const response = await getAiResponse([
  //     planningActionPromptForSystem,
  //     planningActionPromptForUser,
  //   ]);
  const response = await getGpt4Response([
    planningActionPromptForSystem,
    // planningActionPromptForUser,
  ]);
  console.log(response);

  const regex = /\(i=(\d+)\)/;
  const match = response.match(regex);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export async function executionAgent({
  page,
  action,
  screenDescription,
  currentFocusedSection,
  systemLogs,
}: {
  page: PageHandler;
  action: Action;
  screenDescription: string;
  currentFocusedSection: ScreenResult;
  systemLogs: SystemLog[];
}) {
  console.log(`
---------------
Execution Agent:
---------------
`);

  let chats = await getChats();
  let userContext = await getUserGoal(chats);
  let actionValue = "";
  if (action.type == "input") {
    let valueBasedOnHistory = await JSON.parse(
      await findInputTextValue(screenDescription, action.content, userContext)
    );
    if (valueBasedOnHistory.value == null) {
      const question = action.question;

      // TODO: Ask the user the question, and get the answer. Then update chat history in the database.
      // await createAIChat({ content: question || "No Question" });

      chats = await getChats();

      userContext = await getUserGoal(chats);

      valueBasedOnHistory = await JSON.parse(
        await findInputTextValue(screenDescription, action.content, userContext)
      );
    }

    actionValue = valueBasedOnHistory.value;
  } else if (action.type == "select") {
    const options = await page.select(`[i="${action.i}"]`);
    // createAIChat({
    //   content: `Which one do you want?
    // Possible options could be:
    // ${options.actions.map(
    //   (action) => `- ${action.content}\n (i=${action.i}))\n\n`
    // )}`,
    // });

    // TODO: Wait for the user's answer. Then update chat history in the database.
    // suppose the answer is "<integer i>".
    actionValue = "352";
  }
  if (action.type != "select") {
    const confirmationQuestion = await makeQuestionForConfirmation(
      action,
      actionValue,
      screenDescription
    );
    // Add confirmation question to database. TODO: Get the answer.
    // createAIChat({ content: confirmationQuestion });
  }

  // Suppose the answer is "yes"/"no".
  const answer = "yes";

  if (answer == "yes") {
    if (action.type == "input") {
      let rt = await page.inputText(`[i="${action.i}"]`, actionValue);
      return rt;
    } else if (action.type == "click") {
      const actionHistoryDescription = await getActionHistory(
        {
          i: action.i,
          type: "click",
          content: action.content,
          html: action.html,
          question: action.question,
        },
        "yes"
      );
      systemLogs.push({
        id: currentFocusedSection.id,
        type: "action",
        screenDescription: screenDescription,
        actionDescription: actionHistoryDescription,
        screenChangeType: "STATE_CHANGE",
      });

      return await page.click(`[i="${action.i}"]`);
    } else if (action.type == "select") {
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

  const actionComponents: ActionComponent[] = [];

  for (const possibleInteraction of possibleInteractions) {
    const actionType = possibleInteraction.actionType;
    const tagName = possibleInteraction.tagName || "";
    const itemElement = comp.querySelector(`[i="${possibleInteraction.i}"]`);
    const itemDescription = await getItemDescriptionBasedOnCriteria({
      comp: itemElement || comp,
      screenHtml,
      listDescription,
      screenDescription,
      tagName,
    });
    actionComponents.push({
      i: possibleInteraction.i,
      actionType,
      description: itemDescription,
      html: itemElement?.outerHTML || comp.outerHTML,
    });
  }
  return actionComponents;
}

async function getItemDescriptionBasedOnCriteria({
  comp,
  screenHtml,
  listDescription,
  screenDescription,
  tagName,
}: ProcessComponentParams & { tagName: string }) {
  // console.log("tagName: ", tagName);
  // console.log("comp.outerHTML: ", comp.outerHTML);

  return !["ul", "ol"].includes(tagName)
    ? `label-${await extractTextLabelFromHTML(
        comp.outerHTML,
        screenDescription
      )}`
    : `desc-${await getItemDescription({
        itemHtml: comp.outerHTML,
        screenHtml,
        screenDescription: listDescription,
      })}`;
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

  // if (possibleInteractions.length > 5) {
  //   return await parsingAgent({
  //     screenHtml: comp.innerHTML,
  //     screenDescription: partDescription || "",
  //   });
  // }

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
}): Promise<ActionComponent[]> {
  const { screenHtml, screenDescription } = params;
  const dom = new JSDOM(screenHtml);
  const { listDescription } = await getListDescription(
    screenHtml,
    screenDescription
  );

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
  const descriptionCache = loadCacheFromFile("descriptionCache.json");

  const possibleInteractions = parsingPossibleInteractions(screenHtml).sort(
    comparePossibleInteractions
  );

  const dom = new JSDOM(screenHtml);
  const body = dom.window.document.body;

  const actionComponentsPromises = possibleInteractions.map(
    async (interaction) => {
      const iAttr = interaction.i;
      const actionType = interaction.actionType;
      const identifier = interaction.identifier;

      const componentHtml =
        body.querySelector(`[i="${iAttr}"]`)?.outerHTML || "";

      if (descriptionCache.has(identifier)) {
        // console.log(
        //   `Cache hit for "${identifier}": "${descriptionCache.get(identifier)}"`
        // );
        if (!descriptionCache.get(identifier)) {
          return null;
        }
        return {
          i: iAttr,
          actionType: actionType,
          description: descriptionCache.get(identifier),
          html: componentHtml,
        };
      }

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

      descriptionCache.set(identifier, { description: componentDescription });
      saveCacheToFile(descriptionCache, "descriptionCache.json");

      return {
        i: iAttr,
        actionType: interaction.actionType,
        description: componentDescription,
        html: componentHtml,
      };
    }
  );

  const actionComponents = await Promise.all(actionComponentsPromises);
  return actionComponents
    .filter((comp) => comp !== null)
    .sort((a, b) => {
      const iA = parseInt(a!.i, 10);
      const iB = parseInt(b!.i, 10);
      return iA - iB;
    }) as ActionComponent[];
}
