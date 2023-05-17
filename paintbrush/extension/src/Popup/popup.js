import { browser } from "../Vendor/Browser.js";

document
  .querySelector("#open-editor-button")
  .addEventListener("click", async () => {
    let [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["Contentscripts/editor-in-page.js"],
    });

    window.close();
  });

let dev_button = document.querySelector("#developer-button");

let render_dev_button = () => {
  browser.storage.local.get(["is_developer"]).then(({ is_developer }) => {
    dev_button.textContent = is_developer
      ? "Disable Developer Mode"
      : "Enable Developer Mode";
    dev_button.style.color = is_developer ? "#27d5ff" : "inherit";
  });
};

dev_button.addEventListener("click", async () => {
  let { is_developer } = await browser.storage.local.get(["is_developer"]);
  await browser.storage.local.set({ is_developer: !is_developer });
  render_dev_button();
});

render_dev_button();

document
  .querySelector("#options-button")
  .addEventListener("click", async () => {
    // let [current_tab] = await browser.tabs.query({
    //   active: true,
    //   currentWindow: true,
    // });

    // browser.tabs.create({
    //   url: "options/index.html",
    //   active: true,
    // });

    window.close();
  });
