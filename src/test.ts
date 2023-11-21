import dotenv from "dotenv";
import { PageHandler, ScreenResult } from "./utils/pageHandler copy";
dotenv.config();

async function main() {
  const pageHandler = new PageHandler();
  await pageHandler.initialize();

  const showScreenResults = async (screenResults: ScreenResult) => {
    console.log(screenResults);
    await pageHandler.highlightScreenResults(screenResults);
  };

  // const result = await pageHandler.navigate("https://www.greyhound.com", false);
  // const resultTripType = await pageHandler.select(
  //   ".hcr-fieldset-8-7-0.OEcMX.Th_RO",
  //   false,
  //   true
  // );
  // const resultDataInput = await pageHandler.click("#dateInput-from", true);
  // const resultPassengers = await pageHandler.click("#productSummary", true);

  console.log("주소 이동");
  const resultFirst = await pageHandler.navigate(
    "https://m.megabox.co.kr/main",
    false
  );
  console.log("메인 공지 닫기");
  const resultMain = await pageHandler.click(".btn-close-main-notice", false);
  // const resultBook = await pageHandler.click(
  //   "#boxo_movie > div:nth-child(1) > div > div.btn-area > a",
  //   false
  // );
  // const resultLocationChange = await pageHandler.click(
  //   "#branch_area_35 > a",
  //   false
  // );

  // const resultMovies = await pageHandler.select

  // console.log("영화 예매 클릭");
  // const resultBook = await pageHandler.click(
  //   "div.btn-bottom > button:nth-child(3)",
  //   false
  // );

  const resultMovie = await pageHandler.focus(
    "#boxo_movie > div:nth-child(1)",
    true
  );
  // const resultMovie = await pageHandler.focus(
  //   "body > div.container.reserve-main-con.pb55 > div.reserve-wrap > div > div:nth-child(2) > div:nth-child(1)",
  //   true
  // );
  showScreenResults(resultMovie);
  // console.log("영화 별 예매 클릭");
  // const resultMovie = await pageHandler.click(
  //   ".item.movie > a:nth-child(1)",
  //   false
  // );
  // console.log("영화 선택");
  // const resultSelectMovie = await pageHandler.click(
  //   "ul#movieBlockList > li:nth-child(1) > a",
  //   false
  // );
  // console.log("위치 선택");
  // const resultSelectLocation = await pageHandler.click(
  //   "#branch_area_30 > a",
  //   false
  // );
  // console.log("극장 선택");
  // const resultSelectTheater = await pageHandler.click(
  //   "#branch_sub_0039 > a",
  //   false
  // );
  // console.log("선택 완료");
  // const resultComplete = await pageHandler.click("#theaterChoiceBtn", false);

  // const resultSelect = await pageHandler.click("#theaterChoiceBtn", false);

  // const resultLogin = await pageHandler.click(
  //   "div.time-wrap > div:nth-child(2) > a",
  //   false
  // );

  // await pageHandler.inputText("#loginId", "leesang627", false);
  // await pageHandler.inputText("#loginPwd", "EWenavd9pA8^", false);

  // const resultLoginBtn = await pageHandler.click("#loginBtn", true);

  // const resultPeopleNumber = await pageHandler.click(
  //   "div#seatPreviewWrap > div:nth-child(4) > button",
  //   false
  // );
  // await pageHandler.click("#TKA_plus", false);

  // const resultSeatSelect = await pageHandler.click("#seatSelectionBtn", true);

  // const resultDeparture = await pageHandler.click("#s_area", true);
  // const resultDate = await pageHandler.click(".day", true);

  // console.log(resultDate);

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
