// import "./node-polyfills.js";

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { enablePatches } from "immer";

// enablePatches();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);

try {
  // let cool = await navigator.serviceWorker.register(
  //   new URL("./service-worker.js", import.meta.url),
  //   { scope: "/src/" }
  // );
  let cool = await navigator.serviceWorker.register("/service-worker.js", {
    scope: "/",
  });
  console.log(`cool:`, cool);
} catch (error) {
  console.log(`error:`, error);
}
