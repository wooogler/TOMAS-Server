import dotenv from "dotenv";
import { PageHandler, ScreenResult } from "../src/utils/pageHandler";
import {
  getDataFromHTML,
  makeQuestionForActionValue,
  makeQuestionForConfirmation,
} from "./utils/langchainHandler";
import * as fs from "fs";

import { convertSelectResultIntoTable } from "../src/modules/chat/chat.service";
import { simplifyHtml, simplifyItemHtml } from "./utils/htmlHandler";
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
      (comp) => `- ${comp.description} (i=${comp.i})`
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

  // const screen = await pageHandler.select(
  //   ".hcr-fieldset-7-6-0.OEcMX.Th_RO",
  //   false,
  //   true
  // );

  logScreenResult(
    await pageHandler.click(
      ".hcr-btn-7-6-0.hcr-btn--primary-7-6-0.lKKy1",
      false
    )
  );

  const screen = await pageHandler.select(
    ".ResultsList__resultsList___eGsLK",
    false,
    true
  );

  // const table = await convertSelectResultIntoTable(
  //   selectRes.actionComponents,
  //   selectRes.screenDescription
  // );
  // console.log(table);
  // logScreenResult(await pageHandler.click("#dateInput-from", true));

  // logScreenResult(await pageHandler.click("#searchInputMobile-from", false));
  // await pageHandler.inputText("#searchInput-from", "South Bend", false);

  // const screen = await pageHandler.select(
  //   ".hcr-autocomplete__list-7-6-0",
  //   false,
  //   true
  // );
  // logScreenResult(await pageHandler.click('[i="1113"]', true));
  // await new Promise((r) => setTimeout(r, 300000));

  // logScreenResult(await pageHandler.click(".hcr-fieldset-7-6-0", true));
  // logScreenResult(await pageHandler.select(".hcr-fieldset-7-6-0", true));

  const data = await getDataFromHTML(screen);

  fs.writeFile("data.json", JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error("Error writing file", err);
    } else {
      console.log("Successfully wrote to data.json");
    }
  });

  console.log("Done");
}
main();
