import { browser } from "../../Vendor/Browser.js";

let browser_info_promise = browser.runtime.getBrowserInfo
  ? browser.runtime.getBrowserInfo()
  : Promise.resolve({ name: "Chrome" });

let is_firefox = browser_info_promise.then(
  (browser_info) => browser_info.name === "Firefox"
);

/**
 * Sooooo this is pretty silly, but I can't use `window.matchMedia` in MV3 service workers,
 * so I have to execute the script in the page... Hope the reviewers don't mind me adding
 * "scripting" permission just for this :P
 * @param {import("webextension-polyfill-ts").Tabs.Tab} tab
 * @param {string} query
 */
let matchMedia = async (tab, query) => {
  let script_results = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: (query) => {
      return window.matchMedia(query).matches;
    },
    args: [query],
  });

  return { matches: script_results[0].result };
};

export let icon_theme_color = async (tab) => {
  if (await is_firefox) {
    let theme = await browser.theme.getCurrent(tab.windowId);
    if (theme != null && theme.colors != null) {
      return theme.colors.icons;
    }
  }
  return (await matchMedia(tab, "(prefers-color-scheme: dark)")).matches
    ? "rgba(255,255,255,0.8)"
    : "black";
};
