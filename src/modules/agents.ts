import { Chat } from "@prisma/client";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
  makeChatsPrompt,
} from "../utils/langchainHandler";

interface ComponentInfo {
  i: string;
  html: string;
  actionType: string;
  description: string;
}

interface ActionInfo {
  description: string;
}

async function planningAgent(
  components: ComponentInfo[],
  objective: string,
  pageDescription: string,
  completedActions: ActionInfo[]
) {
  const planningActionPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are looking at a webpage.
The description of the webpage: ${pageDescription}

You need to plan the sequence of following possible actions on a single webpage.
Possible actions:
${components
  .map((comp, tmpIndex) => `- ${comp.description} (i=${tmpIndex})`)
  .join("\n")}

Actions should be selected in an order to achieve the task objective: ${objective}

Make a plan except for actions that have already been completed.
Completed actions:
${completedActions.map((action) => `- ${action.description}`).join("\n")}

Return the plan as the list of actions as a numbered list in the format:

#. First action (i=<i>)
#. Second action (i=<i>)

The entries must be consecutively numbered, starting with 1. The number of each entry must be followed by a period.
Do not include any headers before your list or follow your list with any other output.
    `,
  };
  console.log(`
---------------
Planning Agent:
---------------
`);
  console.log(planningActionPrompt);

  const response = await getGpt4Response([planningActionPrompt]);
  const extractFirstItemIValue = (input: string): number | null => {
    const lines = input.split("\n");
    const firstLine = lines[0];
    const match = firstLine.match(/\(i=(\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  };

  console.log(response);
  const firstItemI = extractFirstItemIValue(response);
  if (firstItemI) {
    return components[firstItemI];
  } else {
    throw new Error("No plans");
  }
}

async function executionAgent(
  component: ComponentInfo,
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

  const findUserContextPrompt: Prompt = {
    role: "SYSTEM",
    content: `
Based on the conversation between the system and the user, describe the user's context.

Conversation:
${makeChatsPrompt(chats)}
  `,
  };
  const userContext = await getAiResponse([findUserContextPrompt]);

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
}
