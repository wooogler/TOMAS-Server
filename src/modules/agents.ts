import { Chat } from "@prisma/client";
import { Prompt, getGpt4Response } from "../utils/langchainHandler";

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

async function executionAgent (component: ComponentInfo, chats: Chat[]) {
  if component
}
