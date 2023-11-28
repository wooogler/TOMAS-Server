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

  const resultFirst = await pageHandler.navigate(
    "https://m.megabox.co.kr/main",
    false
  );
  const resultMain = await pageHandler.click(".btn-close-main-notice", false);
  const resultBook = await pageHandler.click(
    "body > div.btn-bottom.bnb-main.col-5.whtm > button:nth-child(3)",
    false
  );
  const resultMovie = await pageHandler.click(
    "body > div.container.reserve-main-con.pb55 > div.reserve-wrap > div > div:nth-child(2) > div:nth-child(1) > a",
    false
  );

  showScreenResults(resultMovie);

  console.log("Done");
}

main();
