import puppeteer, { Browser, Page } from "puppeteer";
import { addIAttribute, trackModalChanges } from "../src/utils/pageHandler";
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
  }, 10000);

  it("should find the new elements after the action", async () => {
    // await getUpdatedHtml(globalPage, async () => {
    await trackModalChanges(globalPage, async () => {
      await globalPage.goto("http://www.greyhound.com", {
        waitUntil: "networkidle0",
      });
    });
    await addIAttribute(globalPage);
    // });

    await trackModalChanges(globalPage, async () => {
      await globalPage.click("#open-burger-menu-button");
    });

    await trackModalChanges(globalPage, async () => {
      await globalPage.click(".flix-header-burger-menu__link");
    });
    await trackModalChanges(globalPage, async () => {
      await globalPage.click(
        'button.flix-header-burger-menu__link[data-popup="language-selection-popup"]'
      );
    });

    await trackModalChanges(globalPage, async () => {
      await globalPage.click("#close-button");
    });

    await trackModalChanges(globalPage, async () => {
      await globalPage.click("#close-burger-menu-button");
    });

    await trackModalChanges(globalPage, async () => {
      await globalPage.click(".hcr-input__field-7-6-0");
    });
  }, 20000);

  // afterEach(async () => {
  //   await globalBrowser.close();
  // });
});
