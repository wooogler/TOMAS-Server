import { PageHandler, ScreenResult } from "../src/utils/pageHandler";

// describe("pageHandler", () => {
//   const pageHandler = new PageHandler();

//   beforeAll(async () => {
//     await pageHandler.initialize();
//   }, 10000);
async function main() {
  const pageHandler = new PageHandler();
  await pageHandler.initialize();
  const logScreenResult = (screen: ScreenResult) => {
    console.log(`
id: ${screen.id}
type: ${screen.type}
description: ${screen.screenDescription}
ActionComponents: 
${screen.actionComponents
  .map((comp) => `- ${comp.description} (i=${comp.i})`)
  .join("\n")}
-------------------------------------------------------
    `);
  };

  const mainScreen = await pageHandler.navigate("https://www.greyhound.com");
  logScreenResult(mainScreen);
  let tmp_str = "365";
  const searchScreen = await pageHandler.click('[i="' + tmp_str + '"]');
  logScreenResult(searchScreen);
  const searchScreen2 = await pageHandler.select(
    ".hcr-autocomplete__list-7-6-0.hcr-autocomplete__list--boxed"
  );
  logScreenResult(searchScreen2);
  tmp_str = "875";
  const searchScreen3 = await pageHandler.select('[i="' + tmp_str + '"]');
  logScreenResult(searchScreen3);
  tmp_str = "901";
  await pageHandler.click('[i="878"]');
  // afterAll(async () => {
  //   await pageHandler.close();
  // });
}
main();
