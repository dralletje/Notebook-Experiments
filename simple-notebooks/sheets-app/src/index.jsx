import React from "react";
import ReactDOM from "react-dom/client";
import App from "./OldApp";
import SheetApp from "./App";
import { enablePatches } from "immer";

// import { App } from "./experiments/use-memo-after-hot-reload/use-memo-after-hot-reload";
// import { App } from "./experiments/use-viewupdate-editor/use-viewupdate-editor";

enablePatches();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<SheetApp />);
// if (window.location.search === "?sheet") {
// } else {
//   root.render(<App />);
// }

navigator.serviceWorker
  .register("/unpkg-cache-service-worker.js")
  .catch((error) => {
    console.log(`Error registering service worker:`, error);
  });
