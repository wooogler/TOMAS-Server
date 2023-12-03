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

export async function planningAgent(
  focusedSection: ScreenResult,
  userGoal: string,
  systemContext: string
) {
  const planningActionPrompt: Prompt = {
    role: "SYSTEM",
    content: `You are an AI agent instructing a user on how to use a mobile website. 
You need to choose which action to take next, based on the basic sequence of actions on the current website, considering the user's goals and action history.

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
