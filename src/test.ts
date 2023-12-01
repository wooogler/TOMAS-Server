import dotenv from "dotenv";
import { PageHandler, ScreenResult } from "./utils/pageHandler copy";
import { getDataFromHTML } from "./prompts/visualPrompts";
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

  const resultBook = await pageHandler.click(
    "body > div.btn-bottom.bnb-main.col-5.whtm > button:nth-child(3)",
    false
  );

  const resultMovie = await pageHandler.click(
    "body > div.container.reserve-main-con.pb55 > div.reserve-wrap > div > div:nth-child(2) > div:nth-child(1) > a",
    false
  );

  const selectTheater = await pageHandler.click("#branch_sub_1372 > a", false);
  const schedule = await pageHandler.click("#theaterChoiceBtn", false);
  const dateSelect = await pageHandler.select("#playDateList", true);

  showScreenResults(dateSelect);

  // console.log("Done");
}
main();
