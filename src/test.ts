import dotenv from "dotenv";
import { PageHandler } from "./utils/pageHandler copy";
dotenv.config();

async function main() {
  const pageHandler = new PageHandler();
  await pageHandler.initialize();

  const result = await pageHandler.navigate2(
    "https://www.greyhound.com",
    false
  );

  result.forEach((res) => {
    console.log(`type: ${res.type}, i: ${res.i}, content: ${res.content}`);
  });

  // const logScreenResult = async (
  //   screen: ScreenResult,
  //   isQuestion: boolean = false
  // ) => {
  //   const actionComponentsDescriptions = screen.actionComponents.map(
  //     (comp) =>
  //       `- ${comp.description} (actionType=${comp.actionType}) (i=${comp.i})`
  //   );

  //   console.log(`
  // id: ${screen.id}
  // type: ${screen.type}
  // description: ${screen.screenDescription}
  // ActionComponents:
  // ${actionComponentsDescriptions.join("\n")}
  // -------------------
  //     `);
  //   if (isQuestion) {
  //     const questions = await Promise.all(
  //       screen.actionComponents.map(async (comp) => {
  //         if (comp.actionType === "click") {
  //           return `- ${await makeQuestionForConfirmation(
  //             comp,
  //             screen.screenDescription
  //           )} (i=${comp.i})`;
  //         } else {
  //           return `- ${await makeQuestionForActionValue(
  //             screen.screenDescription,
  //             comp.description,
  //             comp.html
  //           )} (i=${comp.i})`;
  //         }
  //       })
  //     );

  //     console.log(`Questions:
  // ${questions.join("\n")}
  // -------------------------------------------------------
  //     `);
  //   }
  // };

  //   logScreenResult(
  //     await pageHandler.navigate("https://www.greyhound.com", false)
  //   );

  // select the trip type
  // logScreenResult(
  //   await pageHandler.select(".hcr-fieldset-7-6-0.OEcMX.Th_RO", false, true)
  // );

  // select the departure
  // logScreenResult(await pageHandler.click("#searchInputMobile-from", false));
  // logScreenResult(
  //   await pageHandler.inputText("#searchInput-from", "South Bend", true)
  // );

  //select the arrival
  // logScreenResult(await pageHandler.click("#searchInputMobile-to"), false);
  // logScreenResult(
  //   await pageHandler.inputText("#searchInput-from", "Las Vegas", true)
  // );

  // input the passenger number
  // logScreenResult(
  //   await pageHandler.click('[aria-label="1 Adult, Add passengers"]', true)
  // );
  // logScreenResult(await pageHandler.select(".avRmL", false, true));
  // logScreenResult(await pageHandler.select(".rySY1", true, true));

  // input the calendar
  // logScreenResult(await pageHandler.click("#dateInput-from", true));
  // logScreenResult(
  //   await pageHandler.select(".hcr-clndr-7-6-0.wnaY8", false, true)
  // );
  // logScreenResult(
  //   await pageHandler.select("table.hcr-clndr__table-7-6-0", false, true)
  // );
  // logScreenResult(
  //   await pageHandler.select(".hcr-clndr__table-7-6-0 > tbody", true, true)
  // );

  // const screen = await pageHandler.select(
  //   ".ResultsList__resultsList___eGsLK",
  //   false,
  //   true
  // );

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

  // const data = await getDataFromHTML(screen);

  // fs.writeFile("data.json", JSON.stringify(data, null, 2), (err) => {
  //   if (err) {
  //     console.error("Error writing file", err);
  //   } else {
  //     console.log("Successfully wrote to data.json");
  //   }
  // });

  console.log("Done");
}
main();
