(async () => {
  // prettier-ignore
  const browser = /** @type {import("webextension-polyfill-ts").Browser} */ (globalThis.browser);

  let host = window.location.host;
  let { [host]: css } = await browser.storage.local.get([host]);

  if (css == null) {
    return;
  }

  for (let style of Array.isArray(css) ? css : [css]) {
    try {
      if (style.disabled) continue;

      let element = document.createElement("style");
      // element.innerHTML = css.replace(/(?:!important)? *;(\n|$)/gm, " !important;$1");
      element.innerHTML = style.code;
      element.dataset.paintbrush = "true";
      element.dataset.paintbrushId = style.id;
      element.dataset.paintbrushTitle = style.name;
      document.head.appendChild(element);
    } catch (error) {
      console.debug("Failed to apply paintbrush style:", error.stack);
    }
  }
})();
