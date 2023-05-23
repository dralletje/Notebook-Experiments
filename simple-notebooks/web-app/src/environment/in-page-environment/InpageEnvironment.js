import { AddLogEvent, Engine, UpdateEngineEvent } from "../Environment";

import { outgoing, onUpdateNotebook, LogEvent } from "./in-page-worker-ish";
import { applyPatches } from "immer";

class InpageEngine extends Engine {
  engine = null;

  on_update_engine = (event) => {
    this.engine = applyPatches(this.engine, event.patches);

    this.dispatchEvent(new UpdateEngineEvent(this.engine));
  };
  on_log = (/** @type {LogEvent} */ event) => {
    this.dispatchEvent(new AddLogEvent(event.log));
  };

  constructor(notebook) {
    super();
    this.notebook = notebook;
  }

  start() {
    outgoing.addEventListener("log", this.on_log);
    outgoing.addEventListener("update-engine", this.on_update_engine);
  }
  stop() {
    outgoing.removeEventListener("log", this.on_log);
    outgoing.removeEventListener("update-engine", this.on_update_engine);
  }
  /** @param {import("@dral/javascript-notebook-runner").Notebook} notebook */
  update_notebook(notebook) {
    this.notebook = notebook;
    onUpdateNotebook({ notebook });
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
