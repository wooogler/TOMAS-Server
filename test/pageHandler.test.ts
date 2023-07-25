import puppeteer, { Browser, Page } from "puppeteer";
import { getHighestZIndexElement } from "../src/utils/pageHandler";
import { getVisibleHtml } from "../src/modules/screen/screen.service";

describe("pageHandler", () => {
  let globalBrowser: Browser;
  let globalPage: Page;
  let visiblePage: Page;

  const NO_GLOBAL_PAGE_ERROR = new Error("Cannot find globalPage.");

  async function addIAttribute() {
    if (globalPage) {
      await globalPage.evaluate(() => {
        let idCounter = 0;
        const elements = document.querySelectorAll("*");
        elements.forEach((el) => {
          el.setAttribute("i", String(idCounter));
          idCounter++;
        });
      });
    } else {
      throw NO_GLOBAL_PAGE_ERROR;
    }
  }

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
    await addIAttribute();
  }, 100000);

  it("should return the element with the highest z-index", async () => {
    const initialResult = await getHighestZIndexElement(globalPage);
    console.log("Initial result:", initialResult);

    await globalPage.click("#searchInputMobile-from");

    const afterClickResult = await getHighestZIndexElement(globalPage);
    console.log("Result after clicking the button:", afterClickResult);
  }, 10000);

  // afterAll(async () => {
  //   await globalPage.browser().close();
  // });
});
