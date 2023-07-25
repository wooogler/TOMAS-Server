import puppeteer, { Browser, Page } from "puppeteer";
import { addIAttribute, findNewElementHtml } from "../src/utils/pageHandler";
import { getVisibleHtml } from "../src/modules/screen/screen.service";

describe("pageHandler", () => {
  let globalBrowser: Browser;
  let globalPage: Page;

  const NO_GLOBAL_PAGE_ERROR = new Error("Cannot find globalPage.");

  beforeEach(async () => {
    globalBrowser = await puppeteer.launch({ headless: false });
    globalPage = await globalBrowser.newPage();
    await globalPage.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );
    await globalPage.setViewport({ width: 390, height: 844 });
    await globalPage.goto("http://www.greyhound.com", {
      waitUntil: "networkidle0",
    });
    await addIAttribute(globalPage);
  }, 100000);

  it("should find the elements without i", async () => {
    await globalPage.click("#searchInputMobile-from");
    const afterClickResult = await findNewElementHtml(globalPage);
    console.log("Result after clicking the button:", afterClickResult);
  }, 10000);

  afterAll(async () => {
    await globalPage.browser().close();
  });
});
