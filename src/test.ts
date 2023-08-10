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

  logScreenResult(
    await pageHandler.navigate("https://www.greyhound.com", false)
  );
  logScreenResult(await pageHandler.click(".hcr-fieldset-7-6-0", true));
  logScreenResult(await pageHandler.select(".hcr-fieldset-7-6-0", true));
}
main();
