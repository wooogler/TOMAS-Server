import { parsingAgent } from "../src/utils/htmlHandler";
import { PageHandler } from "../src/utils/pageHandler";

describe("pageHandler", () => {
  const pageHandler = new PageHandler();

  beforeAll(async () => {
    await pageHandler.initialize();
  }, 10000);

  it("navigate and interact with page", async () => {
    const mainScreen = await pageHandler.navigate("https://www.greyhound.com");
    const radioButton = await pageHandler.select('[i="347"]');
  }, 50000);

  // afterAll(async () => {
  //   await pageHandler.close();
  // });
});
