import dotenv from "dotenv";
import { PageHandler, ScreenResult } from "./utils/pageHandler copy";
import { getDataFromHTML } from "./prompts/visualPrompts";
import { loadJsonFromFile } from "./utils/fileUtil";
dotenv.config();

async function main() {
  const pageHandler = new PageHandler();
  await pageHandler.initialize();

  const showScreenResults = async (screenResults: ScreenResult) => {
    console.log(screenResults);
    await pageHandler.highlightScreenResults(screenResults);
  };

  const number = await loginSite(pageHandler, false);
  // const numberScreen = await pageHandler.modifyState(
  //   "#ticketKindList",
  //   "I want to book tickets for 3 adults and 1 child.",
  //   false
  // );
  const upAdult = await pageHandler.click("#TKA_plus", false);
  const clickAgree = await pageHandler.click("#seatSelectionBtn", true);
  showScreenResults(clickAgree);
  // const screenResults = await pageHandler.modifyState(
  //   "#seatLayout > div",
  //   "뒷 자리를 예매해줘.",
  //   true
  // );
}

async function loginSite(pageHandler: PageHandler, parsing = false) {
  const notice = await pageHandler.navigate(
    "https://m.megabox.co.kr/main",
    false
  );
  console.log("notice: ", notice.type);
  const main = await pageHandler.click(".btn-close-main-notice", false);
  console.log("main: ", main.type);
  const book = await pageHandler.click(
    "body > div.btn-bottom.bnb-main.col-5.whtm > button:nth-child(3)",
    false
  );
  console.log("book: ", book.type);
  const theater = await pageHandler.click(
    "body > div.container.reserve-main-con.pb55 > div.reserve-wrap > div > div:nth-child(2) > div:nth-child(1) > a",
    false
  );
  console.log("theater: ", theater.type);
  const selectTheater = await pageHandler.click("#branch_sub_1003 > a", false);
  const schedule = await pageHandler.click("#theaterChoiceBtn", false);
  console.log("schedule: ", schedule.type);

  const selectDate = await pageHandler.click("#playDate_20231130 > a", false);
  const login = await pageHandler.click(
    "#scheduleListWrap > div > div:nth-child(2) > div > div:nth-child(1) > a",
    false
  );
  console.log("login: ", login.type);

  const defaultUserInfo = loadJsonFromFile("userInfo.json") as {
    password: string;
    id: string;
  };
  const inputId = await pageHandler.inputText(
    "#loginId",
    defaultUserInfo.id,
    false
  );
  const inputPassword = await pageHandler.inputText(
    "#loginPwd",
    defaultUserInfo.password,
    false
  );
  const theaterState = await pageHandler.click("#loginBtn", false);
  console.log("theaterState: ", theaterState.type);

  const number = await pageHandler.click(
    "#seatPreviewWrap > div.btn-group.pd0 > button",
    parsing
  );
  console.log("number: ", number.type);
  return number;
}

main();
