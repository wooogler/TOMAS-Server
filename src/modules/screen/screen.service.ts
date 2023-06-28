import puppeteer, { Browser, Page } from "puppeteer";
import { NavigateInput } from "./screen.schema";

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

export async function navigate(input: NavigateInput) {
  globalBrowser = await puppeteer.launch({ headless: false });
  globalPage = await globalBrowser.newPage();
  await globalPage.goto(input.url, {
    waitUntil: "networkidle0",
  });

  await globalPage.evaluate(() => {
    let idCounter = 0;
    const elements = document.querySelectorAll("*");
    elements.forEach((el) => {
      el.setAttribute("i", String(idCounter++));
    });
  });
}
