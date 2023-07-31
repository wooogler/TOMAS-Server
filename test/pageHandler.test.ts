import puppeteer, { Browser, Page } from "puppeteer";
import { addIAttribute, getUpdatedHtml } from "../src/utils/pageHandler";
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
    await addIAttribute(globalPage);
  }, 10000);

  it("should find the new elements after the action", async () => {
    const navigatedHtml: string = await getUpdatedHtml(globalPage, async () => {
      await globalPage.goto("http://www.amtrak.com", {
        waitUntil: "networkidle0",
      });
    });

    console.log("after navigation", navigatedHtml);

    // const dialogHtml: string = await getUpdatedHtml(globalPage, async () => {
    //   await globalPage.click("#mat-input-0");
    // });

    // console.log("after click dialog", dialogHtml);

    // const openHtml: string = await getUpdatedHtml(globalPage, async () => {
    //   await globalPage.click(".flix-header-burger-menu__link");
    // });

    // console.log("after menu button", openHtml);
  }, 20000);

  // afterEach(async () => {
  //   await globalBrowser.close();
  // });
});
