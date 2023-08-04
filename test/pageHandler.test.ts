import { parsingAgent, simplifyHtml } from "../src/utils/htmlHandler";
import { PageHandler } from "../src/utils/pageHandler";

describe("pageHandler", () => {
  const pageHandler = new PageHandler();

  beforeAll(async () => {
    await pageHandler.initialize();
  }, 10000);

  it("navigate and interact with page", async () => {
    const mainScreen = await pageHandler.navigate("https://www.greyhound.com");
    const searchScreen = await pageHandler.click('[i="442"]');

    const busList = searchScreen.actionComponents.find(
      (comp) => comp.i === "158"
    );
    console.log(simplifyHtml(busList?.html || "", true, true));
  }, 100000);

  // afterAll(async () => {
  //   await pageHandler.close();
  // });
});
