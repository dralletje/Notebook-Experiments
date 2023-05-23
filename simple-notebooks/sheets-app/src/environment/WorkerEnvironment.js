import { io } from "socket.io-client";
import { AddLogEvent, Engine, UpdateEngineEvent } from "./Environment";

import { get_worker_environment_worker } from "./worker-environment-worker/worker-environment-worker.js";
import { applyPatches } from "immer";

class WorkerEngine extends Engine {
  /** @type {ReturnType<get_worker_environment_worker>} */
  worker;
  engine = null;

  on_message = (event) => {
    if (event.data.type === "update-engine") {
      this.engine = applyPatches(this.engine, event.data.patches);

      this.dispatchEvent(new UpdateEngineEvent(this.engine));
    } else if (event.data.type === "add-log") {
      this.dispatchEvent(new AddLogEvent(event.data.log));
    }
  };
  on_log = ({ log }) => {
    this.dispatchEvent(new AddLogEvent(log));
  };

  constructor(notebook) {
    super();
    this.notebook = notebook;
  }

  start() {
    this.worker = get_worker_environment_worker();
    this.worker.addEventListener("message", this.on_message);
  }
  stop() {
    this.worker.terminate();
    this.worker.addEventListener("message", this.on_message);
  }
  /** @param {import("@dral/javascript-notebook-runner").Notebook} notebook */
  update_notebook(notebook) {
    this.notebook = notebook;
    this.worker.postMessage({
      type: "update-notebook",
      notebook: notebook,
    });
  }
}

/** @type {import("./Environment.js").Environment} */
export let WorkerEnvironment = {
  createEngine() {
    return new WorkerEngine();
  },
};
