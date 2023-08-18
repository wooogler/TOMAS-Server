import {
  Prompt,
  SystemLog,
  findInputTextValue,
  getActionHistory,
  getGpt4Response,
  getUserContext,
  makeQuestionForActionValue,
  makeQuestionForConfirmation,
} from "../utils/langchainHandler";
import {
  ActionComponent,
  PageHandler,
  ScreenResult,
} from "../utils/pageHandler";
import { getChats } from "./chat/chat.service";
export interface taskList {
  i: string;
  description: string;
}

import { createAIChat } from "./chat/chat.service";
export async function planningAgent(
  focusedSection: ScreenResult,
  userContext: string,
  systemContext: string
) {
  //   userContext = `The user wants to book a one-way bus ticket from South Bend, IN, USA to Chicago, IL, USA.`;
  //   systemContext = `In the page: The general purpose of the web page is to provide information and services related to bus travel, including trip planning, ticket booking, route maps, travel information, and customer support.
  //   - The system clicked on a radio button labeled "One Way" that was already selected, allowing the user to choose a one-way trip.
  //   - The system clicked on the "Departing from Los Angeles, CA" button to choose the location from where you want to depart for your bus trip.
  //  In the modal: The general purpose of the modal in the web page is to allow the user to select their departure location for bus travel.
  //   - The system input 'South Bend' in the departure location text field.
  //   - The system clicked on a list item that displayed the location "South Bend, IN" in the USA.
  //  In the page: The general purpose of the web page is to provide information and services related to bus travel, including trip planning, ticket booking, travel information, and customer support.
  //   - The system clicked on the button labeled "Arriving at Las Vegas, NV" to select the destination for the bus trip.
  //  In the modal: The general purpose of the modal in the web page is to allow the user to select a destination for their bus travel.
  //   - The user input 'Chicago' as the desired destination for the bus travel.
  //   - The system clicked on a list item that displayed the location "Chicago, IL" in the USA.`;

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

First, describe the interaction plan in natural language by referring to the user's and system's contexts. Do not add any useless actions to the plan.

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
