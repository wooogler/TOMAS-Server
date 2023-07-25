import puppeteer, { Browser, Page } from "puppeteer";
import { addIAttribute, findNewElementHtml } from "../src/utils/pageHandler";
import { getVisibleHtml } from "../src/modules/screen/screen.service";

describe("pageHandler", () => {
  let globalBrowser: Browser;
  let globalPage: Page;

  const NO_GLOBAL_PAGE_ERROR = new Error("Cannot find globalPage.");

  beforeEach(async () => {
    globalBrowser = await puppeteer.launch({ headless: false });
    const context = await globalBrowser.createIncognitoBrowserContext(); // Create new incognito context
    globalPage = await context.newPage();

    await globalPage.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );
    await globalPage.setViewport({ width: 390, height: 844 });
    await globalPage.goto("http://www.amazon.com", {
      waitUntil: "networkidle0",
    });
    await addIAttribute(globalPage);
  }, 100000);

  it("should find the modal elements after the action", async () => {
    const longestHTML: string = await findNewElementHtml(
      globalPage,
      async () => {
        await globalPage.click("#glow-ingress-single-line");
      }
    );

    console.log(longestHTML);
  }, 10000);
});
