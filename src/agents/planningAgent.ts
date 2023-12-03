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
export async function planningAgentOriginal(
  focusedSection: ScreenResult,
  userGoal: string,
  systemContext: string
) {
  const planningActionPrompt: Prompt = {
    role: "SYSTEM",
    content: `As an agent, Think the most common method to proceed to next step for the current situation, considering both the user's context and the history of previous actions taken.
Ensure that the action you choose has not been performed previously. 
Reflect on the sequence of actions already performed and their outcomes to make an informed decision about the next step. 
Evaluate the available options based on this historical context and choose one action that seems most appropriate. 
If you determine that no further actions are needed or beneficial, please output 'done'.

${userGoal}

Action History:
${systemContext}

Describe your thought process and choose one action from the available actions on the current screen with its corresponding "(i=##)".

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
    return {
      reason: reasonMatch[1],
      i: iMatch[1],
    };
  }

  return null;
}

export async function planningAgent(
  focusedSection: ScreenResult,
  userGoal: string,
  systemContext: string
) {
  const planningActionPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are an AI agent that navigate with user's smartphone on behalf of users. Consider the user's goals and action history

${userGoal}

Action History:
${systemContext}

Current Screen Description: ${focusedSection.screenDescription}

Explain your thought and choose one action from the available actions on the current screen with its corresponding "(i=##)".

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
    return {
      reason: reasonMatch[1],
      i: iMatch[1],
    };
  }

  return null;
}
