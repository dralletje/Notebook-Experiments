(async () => {
  // prettier-ignore
  const browser = /** @type {import("webextension-polyfill-ts").Browser} */ (globalThis.browser);

  let host = window.location.host;
  let { [host]: css } = await browser.storage.local.get([host]);

  if (css == null) {
    return;
  }

  let style = document.createElement("style");
  // style.innerHTML = css.replace(/(?:!important)? *;(\n|$)/gm, " !important;$1");
  style.innerHTML = Array.isArray(css)
    ? css
        .filter((x) => !x.disabled)
        .map((x) => x.code)
        .join("\n\n")
    : css;
  // @ts-ignore
  style.dataset.dralStyled = true;
  document.head.appendChild(style);
})();
