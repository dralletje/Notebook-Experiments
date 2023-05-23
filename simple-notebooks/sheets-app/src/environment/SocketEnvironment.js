import { io } from "socket.io-client";
import { AddLogEvent, Engine, UpdateEngineEvent } from "./Environment";

class SocketEngine extends Engine {
  /** @private */
  socket = io("http://localhost:3099", {
    autoConnect: false,
  });
  on_engine = ({ filename, engine }) => {
    this.dispatchEvent(new UpdateEngineEvent(engine));
  };
  on_log = ({ log }) => {
    this.dispatchEvent(new AddLogEvent(log));
  };

  constructor(notebook) {
    super();
    this.notebook = notebook;

    this.socket.on("engine", this.on_engine);
    this.socket.on("add-log", this.on_log);
    this.socket.on("connect", () => {
      this.socket.emit("notebook", {
        filename: this.notebook.filename,
        notebook: this.notebook,
      });
    });
  }

  start() {
    this.socket.connect();
  }
  stop() {
    this.socket.disconnect();
  }
  /** @param {import("@dral/javascript-notebook-runner").Notebook} notebook */
  update_notebook(notebook) {
    this.notebook = notebook;
    this.socket.emit("notebook", {
      filename: this.notebook.filename,
      notebook: this.notebook,
    });
  }
}

/** @type {import("./Environment.js").Environment} */
export let SocketEnvironment = {
  createEngine() {
    return new SocketEngine();
  },
};
