import puppeteer, { Browser, Page } from "puppeteer";
import { NavigateInput } from "./screen.schema";
import { simplifyHtml } from "../../utils/htmlHandler";
import prisma from "../../utils/prisma";

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

export async function navigate(input: NavigateInput) {
  globalBrowser = await puppeteer.launch({ headless: false });
  globalPage = await globalBrowser.newPage();
  await globalPage.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
  );
  await globalPage.setViewport({ width: 390, height: 844 });
  await globalPage.goto(input.url, {
    waitUntil: "networkidle0",
  });

  const navigateAction = await prisma.action.create({
    data: {
      type: "GOTO",
      value: input.url,
    },
  });

  await globalPage.evaluate(() => {
    let idCounter = 0;
    const elements = document.querySelectorAll("*");
    elements.forEach((el) => {
      el.setAttribute("i", String(idCounter++));
    });
  });

  const rawHtml = await globalPage.evaluate(() => document.body.innerHTML);
  console.log("rawHtml");
  const simpleHtml = simplifyHtml(rawHtml);
  console.log(simpleHtml);

  const screenResult = await prisma.screen.create({
    data: {
      url: input.url,
      rawHtml,
      simpleHtml,
      prevActionId: navigateAction.id,
    },
    select: {
      rawHtml: true,
      simpleHtml: true,
    },
  });

  return screenResult;
}
