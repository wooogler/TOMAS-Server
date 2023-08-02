import { Chat } from "@prisma/client";
import {
  Prompt,
  getAiResponse,
  getUserContext,
} from "../utils/langchainHandler";
import { ParsingResult } from "./screen/screen.service";
export interface taskList {
  i: string;
  description: string;
}

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
${components
  .map((comp, tmpIndex) => `- ${comp.description} (i=${tmpIndex})`)
  .join("\n")}

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

async function executionAgent(
  component: ParsingResult,
  chats: Chat[],
  pageDescription: string
) {
  console.log(`
---------------
Execution Agent:
---------------
`);

  const makeQuestionPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are looking at a webpage.
The description of the webpage: ${pageDescription}

You need to create a natural language question to ask the user to achieve a given action.
Action:
${component.description}
`,
  };
  const question = await getAiResponse([makeQuestionPrompt]);
  const userContext = await getUserContext(chats);

  //   const findUserContextPrompt: Prompt = {
  //     role: "SYSTEM",
  //     content: `
  // Based on the conversation between the system and the user, describe the user's context.

  // Conversation:
  // ${makeChatsPrompt(chats)}
  //   `,
  //   };
  //   const userContext = await getAiResponse([findUserContextPrompt]);

  // INPUT: User's Context + Action Component
  //
  const clickComponentPrompt: Prompt = {
    role: "SYSTEM",
    content: `
      You are the AI assistant who sees the user's web page. Based on the user's context, you have to decide what to click on in the given HTML on the web page. If you cannot decide what to click according to the context, please explain why you can't. Don't assume general context; only refer to the given user's context.

      Description of the web page:
      ${pageDescription}

      HTML:
      ${component.html}

      User's context:
      ${userContext}

      Output needs to follow one of the JSON formats in plain text. Never provide additional context. 
      {
        reason: <the reason why you cannot decide what to click>,
        element: null
      }
      OR
      {
        reason: <the reason why you need to click the element>,
        element: {
          description: <description of the element to click>,
          html: <HTML of the element to click>,
          i_attribute: <the value of i attribute of the element to click>
        }
      }
    `,
  };

  const inputComponentPrompt: Prompt = {
    role: "SYSTEM",
    content: `
      You are the AI assistant who sees the abstraction of part of the user's web page. Based on the user's context, you have to decide what to input in the given component abstraction on the web page. If you cannot decide what content to fill in the input box, please explain why you can't. Don't assume general context; only refer to the given user's context.

      Description of the web page:
      ${pageDescription}

      Component description:
      ${component.description}
      
      User's context:
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

  const selectComponentPrompt: Prompt = {
    role: "SYSTEM",
    content: "TODO", // TODO
  };

  // Assume that we only have click, inputText, and select actions.
  const componentPrompt: Prompt =
    component.action === "click"
      ? clickComponentPrompt
      : component.action === "inputText"
      ? inputComponentPrompt
      : selectComponentPrompt;

  const actionValue: ActionValue = JSON.parse(
    await getAiResponse([componentPrompt])
  );
  if (actionValue.value) {
    const makeConfirmationPrompts: Prompt[] = [
      {
        role: "SYSTEM",
        content: `
        You are the AI assistant who sees the abstraction of part of the user's web page. You have decided what to do for the given component abstraction on the web page based on the user's context
  
        Now you need to create a human natural language question to confirm the user's aim, without specifying which element to operate or using web terms. Don't assume general context; only refer to the given context. Don't mention the component in your question. Confirm the aim of the value.
  
        The description of the webpage:
        The purpose of the body HTML is to display the content of a webpage for Greyhound, a bus travel company.
  
        Action template:
        {
          "type":  <The definition of the given action>,
          "description": <The description of the specific action component>,
          "value": <(Optional) The value to be filled in the component>
        }
      `,
      },
      {
        role: "HUMAN",
        content: `
        {
          "type": ${component.action},
          "description": ${component.description},
          ${component.action === "click" ? "" : `"value": ${actionValue.value}`}
        }
      `,
      },
    ];
    const confirmation = await getAiResponse(makeConfirmationPrompts);

    // if user respond "Yes", then confirmed
    // if user respond "No", then chat with user
  } else {
    const makeQuestionPrompt: Prompt = {
      role: "SYSTEM",
      content: `
        You are looking at a webpage.
        The description of the webpage: ${pageDescription}
  
        You need to create a natural language question to ask the user to achieve a given action.
        Action:
        ${component.description}
      `,
    };

    const question = await getAiResponse([makeQuestionPrompt]);
    // based on the question & chat, revise context
  }
}
