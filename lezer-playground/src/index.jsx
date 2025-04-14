import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { JavascriptParser } from "./experiments/javascript-parser";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // <React.StrictMode>
  <App />
  // <JavascriptParser />
  // </React.StrictMode>
);
