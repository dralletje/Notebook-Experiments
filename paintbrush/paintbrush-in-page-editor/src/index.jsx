import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// These two are for tracking if the mouse is on the visible part of this iframe.
// If it is, we are fine. If it isn't, we have to yield control back to the parent page.
// The parent page will then set pointer-events: none on the iframe, and call `maybe enable again?` on mousemove
// to give us a chance to take back control.
window.addEventListener("mousemove", (/** @type {MouseEvent} */ event) => {
  let element = document.elementFromPoint(event.clientX, event.clientY);
  if (element == null || element.tagName === "HTML") {
    window.parent.postMessage({ type: "disable me!" }, "*");
  }
});
window.addEventListener("message", (/** @type {MessageEvent} */ message) => {
  if (message.source !== window.parent) return;
  if (message.data?.type === "maybe enable again?") {
    let element = document.elementFromPoint(message.data.x, message.data.y);
    if (element != null && element.tagName !== "HTML") {
      window.parent.postMessage({ type: "enable me!" }, "*");
    }
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
