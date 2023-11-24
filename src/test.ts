import dotenv from "dotenv";
import { PageHandler, ScreenResult } from "./utils/pageHandler copy";
import { getDataFromHTML } from "./prompts/visualPrompts";
import { get } from "http";
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
    true
  );
  // console.log("메인 공지 닫기");
  // const resultMain = await pageHandler.click(".btn-close-main-notice", true);

  showScreenResults(resultFirst);

  // const resultMovie = await pageHandler.click(
  //   "#boxo_movie > div:nth-child(1) > div > div.btn-area > a"
  // );

  // const resultBook = await pageHandler.click("#branch_sub_1372");

  // const resultComplete = await pageHandler.click("#theaterChoiceBtn");

  // const resultSchedule = await pageHandler.select(".theater-group", false);

  // const resultScreen = await pageHandler.focus(
  //   "#scheduleListWrap > div > div:nth-child(2)",
  //   false
  // );
  // const resultTime = await pageHandler.select(
  //   "#scheduleListWrap > div > div:nth-child(2) > div",
  //   true
  // );

  // showScreenResults(resultScreen);

  console.log("Done");
}
main();
