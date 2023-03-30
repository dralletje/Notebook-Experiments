import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { enablePatches } from "immer";

// import { App } from "./experiments/use-memo-after-hot-reload/use-memo-after-hot-reload";
// import { App } from "./experiments/use-viewupdate-editor/use-viewupdate-editor";

enablePatches();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

navigator.serviceWorker
  .register("/service-worker.js", {
    scope: "/",
  })
  .catch((error) => {
    console.log(`Error registering service worker:`, error);
  });
