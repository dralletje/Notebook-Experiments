import { AddLogEvent, Engine, UpdateEngineEvent } from "../Environment";

import { make_engine, LogEvent } from "./in-page-worker-ish";
import { applyPatches } from "immer";
import P5 from "p5";

class InpageEngine extends Engine {
  /** @type {ReturnType<typeof make_engine>} */
  engine = null;

  engine_shadow = null;

  on_update_engine = (event) => {
    this.engine_shadow = applyPatches(this.engine_shadow, event.patches);

    this.dispatchEvent(new UpdateEngineEvent(this.engine_shadow));
  };

  constructor(notebook) {
    super();
    this.notebook = notebook;
  }

  start() {
    this.div = document.createElement("div");
    this.div.id = "p5";

    document.body.appendChild(this.div);

    // outgoing.addEventListener("log", this.on_log);
    this.engine = make_engine({
      element: this.div,
    });
    this.engine.outgoing.addEventListener(
      "update-engine",
      this.on_update_engine
    );
  }
  stop() {
    // outgoing.removeEventListener("log", this.on_log);
    this.engine?.outgoing.removeEventListener(
      "update-engine",
      this.on_update_engine
    );
  }
  /** @param {import("@dral/javascript-notebook-runner").Notebook} notebook */
  update_notebook(notebook) {
    this.notebook = notebook;
    this.engine.onUpdateNotebook({ notebook });
  }

  deserialize(value) {
    return value;
  }
}

/** @type {import("../Environment.js").Environment} */
export let InpageEnvironment = {
  createEngine() {
    return new InpageEngine();
  },
};
