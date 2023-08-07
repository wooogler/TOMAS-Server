import {
  Prompt,
  findInputTextValue,
  getGpt4Response,
  getUserContext,
  makeQuestionForActionValue,
  makeQuestionForConfirmation,
} from "../utils/langchainHandler";
import { PageHandler, ScreenResult } from "../utils/pageHandler";
import { getChats } from "./chat/chat.service";
import { ParsingResult } from "./screen/screen.service";
export interface taskList {
  i: string;
  description: string;
}

import { createAIChat } from "./chat/chat.service";
export async function planningAgent(
  userObjective: string,
  focusedSection: ScreenResult,
  userContext: string,
  systemContext: string
) {
  const planningActionPromptForSystem: Prompt = {
    role: "SYSTEM",
    content: `
You are the AI that creates a plan to interact with the main web page based on the user's and system's contexts.

You need to plan the action sequence using the following possible actions in the part of the web page. Considering the description for the whole page: ${
      focusedSection.screenDescription
    }.

Actions should be selected in order to achieve what the user wants: ${userObjective}. ${userContext}

Possible actions:
${focusedSection.actionComponents
  .map((comp) => `- ${comp.description} (i=${comp.i})`)
  .join("\n")}

Actions should reflect the results of the interactions the system has executed before: ${systemContext}

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

  // Here we assume the response is in the format:
  // 1. <First action> (i=<i>)
  // 2. <Second action> (i=<i>)
  // ...
  const filter: RegExp = /^\d+\./;
  const tasks = response.split("\n").filter((line) => filter.test(line));
  console.log(tasks);
  const taskList: taskList[] = [];
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

interface ActionValue {
  reason: string;
  value: string | null;
}

interface ActionValue {
  reason: string;
  value: string | null;
}

export async function executionAgent(
  page: PageHandler,
  component: ParsingResult,
  //   chats: Chat[],
  screenDescription: string,
  currentFocusedSection: ScreenResult
) {
  console.log(`
---------------
Execution Agent:
---------------
`);

  let chats = await getChats();
  let userContext = await getUserContext(chats);
  let actionValue = "";
  if (component.action == "inputText") {
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
  } else if (component.action == "select") {
    const options = await page.focus(`[i="${component.i}"]`);
    createAIChat({
      content: `Which one do you want?
    Possible options could be:
    ${options.actionComponents.map(
      (action) => `- ${action.description}\n (i=${action.i}))`
    )}`,
    });

    // TODO: Wait for the user's answer. Then update chat history in the database.
    // suppose the answer is "<integer i>".
    actionValue = "1";
  }
  const confirmationQuestion = await makeQuestionForConfirmation(
    component,
    actionValue
  );

  // Add confirmation question to database. TODO: Get the answer.
  createAIChat({ content: confirmationQuestion });

  // Suppose the answer is "yes"/"no".
  const answer = "yes";

  if (answer == "yes") {
    if (component.action == "inputText") {
      return await page.inputText(`[i=${component.i}]`, actionValue);
    } else if (component.action == "click") {
      return await page.click(`[i="${component.i}"]`);
    } else if (component.action == "select") {
      return await page.focus(`[i="${component.i}"]`);
    }
  }
  return currentFocusedSection;
  // TODO: Update task history or system context in the database.
}
