import { AnswerResponse } from "../modules/chat/chat.schema";
import { editActionType } from "../utils/htmlHandler";
import { Prompt, getAiResponse } from "../utils/langchainHandler";
import { ActionComponent, ScreenChangeType } from "../utils/pageHandler";
import { Action } from "../utils/parsingAgent";

export async function findInputTextValue(
  pageDescription: string,
  componentDescription: string | undefined,
  userContext: string
) {
  const inputComponentPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are the AI assistant who sees the abstraction of part of the user's web page. Based on the user's context, you have to decide what to input in the given component abstraction on the web page. If you cannot decide what content to fill in the input box, please explain why you can't. Don't assume general context; only refer to the given user's context.

Description of the web page:
${pageDescription}

Component description:
${componentDescription}

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
  return await getAiResponse([inputComponentPrompt]);
}

export async function findSelectValue(
  pageDescription: string,
  componentDescription: string,
  userContext: string
) {
  const inputComponentPrompt: Prompt = {
    role: "SYSTEM",
    content: `
You are the AI assistant who sees the abstraction of part of the user's web page. Based on the user's context, you have to decide what to input in the given component abstraction on the web page. If you cannot decide what content to fill in the input box, please explain why you can't. Don't assume general context; only refer to the given user's context.

Description of the web page:
${pageDescription}

Component description:
${componentDescription}

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
  const response = await getAiResponse([inputComponentPrompt]);
  console.log(response);
  return response;
}

export function getActionHistoryOld(action: Action, actionValue: string) {
  const actionType = action.type;
  const actionContent = action.content;
  if (actionType === "click") {
    if (actionValue === "yes") {
      return `${actionContent}`;
    } else {
      return `Not ${actionContent.toLowerCase()}`;
    }
  } else if (actionType === "input") {
    return `Input ${actionValue} for ${actionContent.toLowerCase()}`;
  } else {
    return `Select ${actionValue} for ${actionContent.toLowerCase()}`;
  }
}

export async function getActionHistory(action: Action, actionValue: string) {
  let actionDone = "";
  const actionType = action.type;
  if (actionType === "click") {
    if (actionValue === "yes") {
      actionDone = "Do click";
    } else {
      actionDone = "Don't click";
    }
  } else {
    actionDone = actionValue;
  }
  const actionHistoryPrompt: Prompt = {
    role: "SYSTEM",
    content: `Here are the actions that the system tried and have done on the web page. 

Tried: ${action.content}
Done: ${
      actionType === "click"
        ? `${actionDone}`
        : `${editActionType(actionType)} '${actionDone}'`
    }

Describe the action on the web page in one sentence`,
  };
  return await getAiResponse([actionHistoryPrompt]);
}

export interface SystemLog {
  id: string;
  type: string;
  screenDescription: string;
  actionDescription: string;
  screenChangeType: ScreenChangeType;
}

export async function getSystemContext(systemLogs: SystemLog[]) {
  let actionHistory: {
    type: string;
    description: string;
  }[] = [];
  systemLogs.forEach((log) => {
    // Action in new screen
    if (log.screenChangeType !== "STATE_CHANGE") {
      actionHistory.push({
        type: log.type,
        description: log.screenDescription,
      });
    }
    actionHistory.push({
      type: "action",
      description: log.actionDescription,
    });
  });
  // console.log(actionHistory);

  //   const makeSystemContextPrompt: Prompt = {
  //     role: "SYSTEM",
  //     content: `Based on the history of the system's actions, please describe the actions the system have done in natural language.

  // Action History:
  // ${actionHistory.map((item) => {
  //   if (item.type !== "action") {
  //     return `In ${item.type}: ${item.description}\n`;
  //   } else {
  //     return ` - ${item.description}\n`;
  //   }
  // })}
  // `,
  //   };
  //   console.log(makeSystemContextPrompt.content);

  //   const systemContext = await getAiResponse([makeSystemContextPrompt]);

  const systemContext = actionHistory
    .map((item) => {
      if (item.type !== "action") {
        return `In the ${item.type}: ${item.description}`;
      } else {
        return ` - ${item.description}`;
      }
    })
    .join("\n");
  return systemContext;
}
