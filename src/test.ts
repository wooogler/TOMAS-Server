import { PageHandler, ScreenResult } from "../src/utils/pageHandler";
import dotenv from "dotenv";
import {
  makeQuestionForActionValue,
  makeQuestionForConfirmation,
} from "./utils/langchainHandler";
dotenv.config();

// describe("pageHandler", () => {
//   const pageHandler = new PageHandler();

//   beforeAll(async () => {
//     await pageHandler.initialize();
//   }, 10000);

async function main() {
  const pageHandler = new PageHandler();
  await pageHandler.initialize();
  const logScreenResult = async (
    screen: ScreenResult,
    isQuestion: boolean = false
  ) => {
    const actionComponentsDescriptions = screen.actionComponents.map(
      (comp) =>
        `- ${comp.description} (action: ${comp.actionType}) (i=${comp.i})`
    );

    console.log(`
id: ${screen.id}
type: ${screen.type}
description: ${screen.screenDescription}
ActionComponents: 
${actionComponentsDescriptions.join("\n")}
-------------------
    `);
    if (isQuestion) {
      const questions = await Promise.all(
        screen.actionComponents.map(async (comp) => {
          if (comp.actionType === "click") {
            return `- ${await makeQuestionForConfirmation(
              comp,
              screen.screenDescription
            )} (i=${comp.i})`;
          } else {
            return `- ${await makeQuestionForActionValue(
              screen.screenDescription,
              comp.description
            )} (i=${comp.i})`;
          }
        })
      );

      console.log(`Questions:
${questions.join("\n")}
-------------------------------------------------------
    `);
    }
  };

  logScreenResult(
    await pageHandler.navigate("https://www.greyhound.com", false)
  );
  logScreenResult(
    await pageHandler.click(
      ".hcr-btn-7-6-0.hcr-btn--primary-7-6-0.lKKy1",
      false
    )
  );
  const list = await pageHandler.select(
    ".ResultsList__resultsList___eGsLK",
    false,
    true
  );
  logScreenResult(list);
  // logScreenResult(
  //   await pageHandler.select(`[i="${list.actionComponents[0].i}"]`, true, true)
  // );

  // logScreenResult(
  //   await pageHandler.select(
  //     "ul.ResultsList__resultsList___eGsLK > li.nth-child(4)",
  //     true
  //   )
  // );
  // logScreenResult(await pageHandler.click("#dateInput-from", true));

  // logScreenResult(await pageHandler.click("#searchInputMobile-from", false));
  // logScreenResult(
  //   await pageHandler.inputText("#searchInput-from", "South Bend", false)
  // );
  // logScreenResult(await pageHandler.click('[i="1113"]', true));
  // await new Promise((r) => setTimeout(r, 300000));

  // logScreenResult(await pageHandler.click(".hcr-fieldset-7-6-0", true));
  // logScreenResult(await pageHandler.select(".hcr-fieldset-7-6-0", true));
}
main();
