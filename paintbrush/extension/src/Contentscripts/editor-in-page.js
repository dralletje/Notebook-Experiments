{
  // @ts-ignore
  // prettier-ignore
  const browser = /** @type {import("webextension-polyfill-ts").Browser} */ (globalThis.browser);

  let URL_DEVELOPMENT = (path) => `http://localhost:3000/${path}`;
  let URL_PRODUCTION = (path) =>
    browser.runtime.getURL(`/in-page-editor-build/${path}`);

  let async = async (async) => async();

  /**
   * @param {string} htmlString
   * @returns {HTMLElement}
   */
  let createElementFromHTML = (htmlString) => {
    let div = document.createElement("div");
    div.innerHTML = htmlString.trim();

    // @ts-ignore
    return div.firstChild;
  };

  let querySelectorAllSafe = (selector) => {
    try {
      return document.querySelectorAll(selector);
    } catch (error) {
      return [];
    }
  };

  // prettier-ignore
  let preexisting_conditions = document.querySelector("paintbrush-overlay-container")
  if (preexisting_conditions) {
    preexisting_conditions.remove();
  } else {
    let should_invert = document.documentElement
      // @ts-ignore
      .computedStyleMap()
      .get("filter")
      .toString()
      .includes("invert(1)");

    // prettier-ignore
    let shadow_element = createElementFromHTML(`<paintbrush-overlay-container style="z-index: 10000000"></paintbrush-overlay-container>`);
    let shadow_root = shadow_element.attachShadow({ mode: "open" });

    document.body.appendChild(shadow_element);

    // prettier-ignore
    shadow_root.appendChild(createElementFromHTML(`<style>
    @keyframes slidein {
      from {
        opacity: 0;
      }
    
      80% {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
    .highlight-overlay {
      animation-duration: 1.2s;
      /* animation-name: slidein; */
    }  

    :host > * {
      filter: ${should_invert ? "invert(1)" : "invert(0)"};
    }

    .highlight-overlay, .highlight-overlay:before, .highlight-overlay:after {
      --border-size: 2px;
      --color-1-size: 10px;
      --color-2-size: 10px;
      --color-1: black;
      --color-2: white;
    }
    .highlight-overlay {
      background-color: rgb(123 201 255 / 52%);
      pointer-events: none;
    }
    .highlight-overlay:before {
      content: "";
      position: absolute;
      inset: -1px;
  
      border: solid;
      border-image: repeating-linear-gradient( to right, var(--color-1) calc(0 * var(--color-1-size) + 0 * var(--color-2-size)), var(--color-1) calc(1 * var(--color-1-size) + 0 * var(--color-2-size)), var(--color-2) calc(1 * var(--color-1-size) + 0 * var(--color-2-size)), var(--color-2) calc(1 * var(--color-1-size) + 1 * var(--color-2-size)) );
      border-image-slice: 1;
      border-image-width: var(--border-size) 0;
    }
    .highlight-overlay:after {
      content: "";
      position: absolute;
      inset: -1px;
  
      border: solid;
      border-image: repeating-linear-gradient( to bottom, var(--color-1) calc(0 * var(--color-1-size) + 0 * var(--color-2-size)), var(--color-1) calc(1 * var(--color-1-size) + 0 * var(--color-2-size)), var(--color-2) calc(1 * var(--color-1-size) + 0 * var(--color-2-size)), var(--color-2) calc(1 * var(--color-1-size) + 1 * var(--color-2-size)) );
      border-image-slice: 1;
      border-image-width: 0 var(--border-size);
    }
  `))
    async(async () => {
      let { is_developer } = await browser.storage.local.get(["is_developer"]);

      let get_url = is_developer ? URL_DEVELOPMENT : URL_PRODUCTION;

      let css_color_scheme = shadow_element
        // @ts-ignore
        .computedStyleMap()
        .get("color-scheme")
        .toString();

      /** @type {HTMLIFrameElement} */
      let injection = /** @type {any} */ (
        createElementFromHTML(`
          <iframe
            border="0"
            style="
              border: none;
              position: fixed;
              inset: 0;
              height: 100vh;
              width: 100vw;
              z-index: 10;
              color-scheme: dark;

              opacity: 0;
              transition: opacity 0.2s ease-in-out;
            "
            allowtransparency="true"
            src="${get_url("index.html")}?color-scheme=${css_color_scheme}"
          />
        `)
      );

      shadow_root.appendChild(injection);

      let contentWindow = injection.contentWindow;

      window.addEventListener("mousemove", (event) => {
        contentWindow.postMessage(
          {
            type: "maybe enable again?",
            x: event.clientX,
            y: event.clientY,
          },
          "*"
        );
        // console.log(`element_in_iframe:`, element_in_iframe);
      });

      // let timer = setInterval(() => {
      //   for (let element of shadow_root.querySelectorAll(
      //     ".highlight-overlay"
      //   )) {
      //   }
      //   let overlay = overlay_ref.current;
      //   overlay.style.position = "absolute";
      //   overlay.style.top = `${rect.top - 4}px`;
      //   overlay.style.left = `${rect.left - 4}px`;
      //   overlay.style.width = `${rect.width + 8}px`;
      //   overlay.style.height = `${rect.height + 8}px`;
      // }, 100);

      window.addEventListener("message", (message) => {
        if (message.source !== contentWindow) return;

        if (message.data?.type === "css") {
          let styletag = /** @type {HTMLStyleElement} */ (
            document.querySelector(`[data-dral-styled]`)
          );
          if (styletag == null) {
            styletag = document.createElement("style");
            styletag.dataset.dralStyled = "true";
            document.head.appendChild(styletag);
          }
          styletag.innerHTML = message.data?.code;
        } else if (message.data?.type === "ready") {
          console.debug("MESSAGE FROM EDITOR:", "ready");
          injection.style.opacity = `1`;
        } else if (message.data?.type === "save") {
          console.debug("MESSAGE FROM EDITOR:", "save");
          let host = window.location.host;
          browser.storage.local.set({ [host]: message.data?.cells });
        } else if (message.data?.type === "load") {
          console.debug("MESSAGE FROM EDITOR:", "load");
          let host = window.location.host;
          browser.storage.local.get([host]).then(({ [host]: cells }) => {
            contentWindow.postMessage({ type: "load", cells }, "*");
          });
        } else if (message.data?.type === "toggle-horizontal-position") {
          console.debug("MESSAGE FROM EDITOR:", "toggle-horizontal-position");
          if (injection.style.right !== "") {
            injection.style.right = "";
            injection.style.left = "16px";
          } else {
            injection.style.right = "16px";
            injection.style.left = "";
          }
        } else if (message.data?.type === "highlight_selector") {
          let { selector } = message.data;
          console.debug("MESSAGE FROM EDITOR:", "highlight_selector", selector);

          // prettier-ignore
          for (let existing_selector of shadow_root.querySelectorAll(`.highlight-overlay`)) {
            existing_selector.remove();
          }

          if (selector != null) {
            let elements = querySelectorAllSafe(selector);
            let outside_of_the_viewport = {
              top: [],
              bottom: [],
              left: [],
              right: [],
            };
            for (let element of elements) {
              let box = element.getBoundingClientRect();

              // Don't show if box is outside the viewport
              if (box.top > window.innerHeight) {
                outside_of_the_viewport.top.push(element);
                continue;
              }
              if (box.bottom < 0) {
                outside_of_the_viewport.bottom.push(element);
                continue;
              }
              if (box.left > window.innerWidth) {
                outside_of_the_viewport.left.push(element);
                continue;
              }
              if (box.right < 0) {
                outside_of_the_viewport.right.push(element);
                continue;
              }

              let injection = createElementFromHTML(`
                  <div
                    class="highlight-overlay"
                    style="
                      position: fixed;
                      top: ${box.top}px;
                      left: ${box.left}px;
                      width: ${box.width}px;
                      height: ${box.height}px;
                    "
                  >
                  </div>
                `);
              // @ts-ignore
              injection.element_to_follow = element;
              shadow_root.appendChild(injection);
            }

            console.log(`outside_of_the_viewport:`, outside_of_the_viewport);

            if (outside_of_the_viewport.top.length !== 0) {
              // AAAAGHHHH,
              // is there a way to know what scroll container to show the "there is more content" message in?
              // Should be possible to have multiple indicators in the same direction, but not in the same container.
              // document.body.appendChild(createElementFromHTML(`
              //   <div
              //     style="
              //       position: fixed;
              //       top: 0;
              //       left: ${box.left}px;
              //       width: ${box.width}px;
              //       height: ${box.height}px;
              //       /* border: dashed 5px white; */
              //     "
              //   >
              //   </div>
              // `));
            }
          }
        } else if (message.data?.type === "disable me!") {
          console.debug("MESSAGE FROM EDITOR:", "disable me!");
          injection.style.pointerEvents = "none";
        } else if (message.data?.type === "enable me!") {
          console.debug("MESSAGE FROM EDITOR:", "enable me!");
          injection.style.pointerEvents = "auto";
        } else if (message.data?.type === "scroll-into-view") {
          console.debug("MESSAGE FROM EDITOR:", "scroll-into-view");
          let { selector } = message.data;
          let elements = document.querySelectorAll(selector);

          if (elements.length === 0) {
            window.alert(`No element with the selector \`${selector}\` found.`);
          }

          let element_closest_to_viewport = elements[0];
          for (let element of elements) {
            // If element is inside the viewport
            console.log(
              `element.getBoundingClientRect().top < window.innerHeight:`,
              element.getBoundingClientRect().top,
              window.innerHeight
            );
            console.log(
              `element.getBoundingClientRect().bottom > 0:`,
              element.getBoundingClientRect().bottom,
              0
            );
            if (
              element.getBoundingClientRect().top < window.innerHeight &&
              element.getBoundingClientRect().bottom > 0
            ) {
              element_closest_to_viewport = element;
              break;
            }

            if (
              Math.abs(element.getBoundingClientRect().top) <
              Math.abs(element_closest_to_viewport.getBoundingClientRect().top)
            ) {
              element_closest_to_viewport = element;
            }

            // let y_distance = Math.min(Math.abs(element.getBoundingClientRect().top), Math.abs(element.getBoundingClientRect().bottom - window.innerHeight))
            // if (element.getBoundingClientRect().top < 0) {
            //   element_closest_to_viewport = element;
            // }
          }
          element_closest_to_viewport.scrollIntoViewIfNeeded({
            behavior: "smooth",
            block: "center",
          });
        } else {
          console.warn("MESSAGE FROM EDITOR:", "Unknown type:", {
            data: message.data,
            message: message,
          });
        }
      });
      console.log("Injected!");
    });
  }
}
