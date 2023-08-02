import { PageHandler } from "../src/utils/pageHandler";

describe("pageHandler", () => {
  const pageHandler = new PageHandler();

  beforeAll(async () => {
    await pageHandler.initialize();
  }, 10000);

  test("navigate and interact with page", async () => {
    await pageHandler.navigate("https://www.greyhound.com");
    await pageHandler.click('button[aria-label="Search trips"]');
  }, 50000);

  // Other tests if needed...

  // afterAll(async () => {
  //   await pageHandler.close();
  // });
});
