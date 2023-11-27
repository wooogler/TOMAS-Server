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
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { getChats, createAIChat } from "./chat/chat.service";
import {
  SystemLog,
  findInputTextValue,
  getActionHistory,
} from "../prompts/actionPrompts";

import {
  getListDescription,
  getItemDescription,
  getPartDescription,
  getSelectInfo,
  getComponentInfo,
} from "../prompts/screenPrompts";
import { extractTextLabelFromHTML } from "../prompts/visualPrompts";
import { loadCacheFromFile, saveCacheToFile } from "../utils/fileUtil";

export async function planningAgent(
  focusedSection: ScreenResult,
  userGoal: string,
  systemContext: string
) {
  const planningActionPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are an AI planning agent. 
Your task is to analyze the user's context in conjunction with the action logs to determine the most logical and practical next step. 
Use the action logs to understand the user's previous interactions and progress towards their goal. 
Consider what actions have been taken and how they influence the best course of action moving forward.

User's context:
${userGoal}

Action Logs:
${systemContext}

Describe your thought process and reasoning for how to proceed.

Then, from the available actions on the current screen, choose one next action with its corresponding "(i=##)" that is most likely to assist the user in a practical and effective manner.

Current Screen Description: ${focusedSection.screenDescription}

Available actions:
${focusedSection.actions
  .map((comp) => `- ${comp.content} (i=${comp.i})`)
  .join("\n")}
`,
  };
  console.log(planningActionPrompt.content);
  console.log(`
---------------
Planning Agent:
---------------
`);

  const organizePlanPrompt: Prompt = {
    role: "HUMAN",
    content: `Output the reason why you choose the action in one user-friendly sentence and the next action itself with its corresponding "(i=##)" in the following format:
Reason: <reason>
Next action: <action> (i=<i>)`,
  };

  const response = await getGpt4Response([planningActionPrompt]);
  console.log(response);
  const answer = await getAiResponse([
    planningActionPrompt,
    { role: "AI", content: response },
    organizePlanPrompt,
  ]);
  console.log(answer);

  // <reason> 추출을 위한 정규 표현식
  const reasonRegex = /Reason: (.+?)\n/;
  // <i> 추출을 위한 정규 표현식
  const iRegex = /\(i=(\d+)\)/;

  const reasonMatch = answer.match(reasonRegex);
  const iMatch = answer.match(iRegex);
  if (reasonMatch && iMatch) {
    const reason = reasonMatch[1];
    const i = iMatch[1];
    return {
      reason: reasonMatch[1],
      i: iMatch[1],
    };
  }

  return null;
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
