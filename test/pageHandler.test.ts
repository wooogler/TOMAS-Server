import { parsingAgent, simplifyHtml } from "../src/utils/htmlHandler";
import { makeQuestionForConfirmation } from "../src/utils/langchainHandler";
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

  it("navigate and interact with page", async () => {
    const mainScreen = await pageHandler.navigate("https://www.greyhound.com");
    logScreenResult(mainScreen);
    const tripTypeSection = await pageHandler.focus('[i="347"]');
    logScreenResult(tripTypeSection);
  }, 100000);

  // afterAll(async () => {
  //   await pageHandler.close();
  // });
});
