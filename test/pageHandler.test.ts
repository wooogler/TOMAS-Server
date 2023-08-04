import { parsingAgent, simplifyHtml } from "../src/utils/htmlHandler";
import { makeQuestionForConfirmation } from "../src/utils/langchainHandler";
import { PageHandler } from "../src/utils/pageHandler";

describe("pageHandler", () => {
  const pageHandler = new PageHandler();

  beforeAll(async () => {
    await pageHandler.initialize();
  }, 10000);

  it("navigate and interact with page", async () => {
    const mainScreen = await pageHandler.navigate("https://www.greyhound.com");
    const searchScreen = await pageHandler.click('[aria-label="Search trips"]');
    const BusList = await pageHandler.select(
      ".ResultsList__resultsList___eGsLK"
    );
  }, 100000);

  // afterAll(async () => {
  //   await pageHandler.close();
  // });
});
