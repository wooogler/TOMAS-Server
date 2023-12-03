import { AnswerResponse } from "../modules/chat/chat.schema";
import { editActionType } from "../utils/htmlHandler";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { ActionComponent, ScreenChangeType } from "../utils/pageHandler";
import { Action } from "../agents/parsingAgent";

export async function findInputTextValue(
  inputActionDescription: string,
  userInfo: object
) {
  const findInputValuePrompt: Prompt = {
    role: "SYSTEM",
    content: `Given the User Info and a description of an input action, determine the value required for the input action from the User Info. 
If the required value is present in the User Info, output that value only. 
If the value cannot be found, output 'null'.

User Info: 
${Object.entries(userInfo)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}

Input Action Description:
${inputActionDescription}
`,
  };

  console.log(findInputValuePrompt.content);

  const value = await getGpt4Response([findInputValuePrompt]);
  if (value === "null") {
    return null;
  }
  console.log("actionValue: ", value);
  return value;
}

export async function getActionHistory(
  action: Action,
  actionValue: string,
  screenDescription?: string
) {
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
    content: `Here are the suggested action and what the user have done on the web page. 
${screenDescription ? `Screen: ${screenDescription}` : ""}
Action: ${action.content}
Done: ${
      actionType === "click"
        ? `${actionDone}`
        : `${editActionType(actionType)} '${actionDone}'`
    }

Describe the user's action on the web page in one sentence`,
  };

  console.log(actionHistoryPrompt.content);
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
