import { parsingAgent, simplifyHtml } from "../src/utils/htmlHandler";
import { makeQuestionForConfirmation } from "../src/utils/langchainHandler";
import { PageHandler, ScreenResult } from "../src/utils/pageHandler";

describe("pageHandler", () => {
  const pageHandler = new PageHandler();

  beforeAll(async () => {
    await pageHandler.initialize();
  }, 10000);

  const logScreenResult = (screen: ScreenResult) => {
    if (screen.screenDescription === "") {
      console.log(`
id: ${screen.id}
type: ${screen.type}
-------------------------------------------------------
`);
    } else {
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
    }
  };

  it("navigate and interact with page", async () => {
    logScreenResult(
      await pageHandler.navigate("https://www.greyhound.com", true)
    );
    logScreenResult(await pageHandler.select(".hcr-fieldset-7-6-0", true));
  }, 100000);
});
