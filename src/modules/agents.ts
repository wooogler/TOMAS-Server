import {
  Prompt,
  findInputTextValue,
  getAiResponse,
  getUserContext,
  makeQuestionForActionValue,
  makeQuestionForConfirmation,
} from "../utils/langchainHandler";
import { PageHandler } from "../utils/pageHandler";
import { getChats } from "./chat/chat.service";
import { ParsingResult } from "./screen/screen.service";
export interface taskList {
  i: string;
  description: string;
}

import { createAIChat } from "./chat/chat.service";
export async function planningAgent(
  components: ParsingResult[],
  userObjective: string,
  userContext: string,
  systemContext: string
) {
  const planningActionPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are the AI that creates a plan to interact with the main web page based on the user's and system's contexts.

You need to plan the action sequence using the following possible actions on the webpage.
Possible actions:
${components.map((comp) => `- ${comp.description} (i=${comp.i})`).join("\n")}

Actions should be selected in order to achieve what the user wants: ${userObjective}. ${userContext}

Actions should reflect the results of the interactions the system has executed before: ${systemContext}

First, describe the most effective interaction plan in natural language by referring to the user's and system's contexts.

Then, return the plan as the list of actions as a numbered list in the format:

#. <First action> (i=<i>)
#. <Second action> (i=<i>)

The entries must be consecutively numbered, starting with 1. The number of each entry must be followed by a period.
Do not include any headers before your list or follow your list with any other output. No other information should be included in the output.
    `,
  };
  console.log(`
---------------
Planning Agent:
---------------
`);
  console.log(planningActionPrompt.content);
  const response = await getAiResponse([planningActionPrompt]);
  //   const response = await getGpt4Response([planningActionPrompt]);
  // const extractFirstItemIValue = (input: string): number | null => {
  //   const lines = input.split("\n");
  //   const firstLine = lines[0];
  //   const match = firstLine.match(/\(i=(\d+)\)/);
  //   return match ? parseInt(match[1], 10) : null;
  // };

  //   console.log(response);
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
  screenDescription: string
) {
  console.log(`
---------------
Execution Agent:
---------------
`);

  let chats = await getChats();
  const userContext = await getUserContext(chats);
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
      valueBasedOnHistory = await JSON.parse(
        await findInputTextValue(
          screenDescription,
          component.description,
          userContext
        )
      );
    }

    actionValue = valueBasedOnHistory.value;
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
      await page.inputText(`[i=${component.i}]`, actionValue);
    } else if (component.action == "click") {
      await page.click(`[i="${component.i}"]`);
    }
  }

  // TODO: Update task history or system context in the database.
}
