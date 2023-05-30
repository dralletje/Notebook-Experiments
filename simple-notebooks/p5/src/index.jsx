import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { enablePatches } from "immer";

enablePatches();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

navigator.serviceWorker
  .register("/unpkg-cache-service-worker.js")
  .catch((error) => {
    console.log(`Error registering service worker:`, error);
  });
