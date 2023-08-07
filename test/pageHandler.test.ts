import { parsingAgent, simplifyHtml } from "../src/utils/htmlHandler";
import {
  ActionLog,
  makeQuestionForConfirmation,
} from "../src/utils/langchainHandler";
import { PageHandler, ScreenResult } from "../src/utils/pageHandler";

describe("pageHandler", () => {
  const pageHandler = new PageHandler();

  beforeAll(async () => {
    await pageHandler.initialize();
  }, 10000);

  const logScreenResult = (screen: ScreenResult) => {
    console.log(`
id: ${screen.id}
type: ${screen.type}
description: ${screen.screenDescription}
ActionComponents: 
${screen.actionComponents
  .map((comp) => `- ${comp.description} (i=${comp.i})`)
  .join("\n")}
-------------------------------------------------------
    `);
  };

  const makeSystemContext = (actionLog: ActionLog[]) => {
    let actionHistory: {
      type: "screen" | "action";
      description: string;
    }[] = [];
    let prevId = "";
    actionLog.forEach((log) => {
      if (prevId !== log.id) {
        actionHistory.push({
          type: "screen",
          description: log.screenDescription,
        });
        actionHistory.push({
          type: "action",
          description: log.actionDescription,
        });
        prevId = log.id;
      } else {
        actionHistory.push({
          type: "action",
          description: log.actionDescription,
        });
      }
    });
  };

  it("navigate and interact with page", async () => {
    const mainScreen = await pageHandler.navigate("https://www.greyhound.com");
    logScreenResult(mainScreen);
    const searchScreen = await pageHandler.click('[i="442"]');
    logScreenResult(searchScreen);
    const options = await pageHandler.select('[i="163"]');
    logScreenResult(options);
  }, 100000);

  // afterAll(async () => {
  //   await pageHandler.close();
  // });
});
