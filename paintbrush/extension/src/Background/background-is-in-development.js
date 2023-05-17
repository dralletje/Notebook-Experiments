import { browser } from "../Vendor/Browser.js";

browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  let { installType } = await browser.management.getSelf();
  console.log(`installType:`, installType);
  return { environment: installType };
});
