import { isEqual } from "lodash";
import React from "react";

/**
 * @param {{ filename: string, notebook: import("../packages/codemirror-notebook/cell").NotebookSerialized }} notebook
 * @param {import("socket.io-client").Socket} socket
 * @returns {import("../packages/codemirror-notebook/cell").EngineShadow}
 */
export let useEngine = (notebook, socket) => {
  let [engine, set_engine] = React.useState({ cylinders: {} });
  React.useEffect(() => {
    socket.on("engine", ({ filename, engine }) => {
      if (filename === notebook.filename) {
        set_engine(engine);
      }
    });
    socket;
  }, []);

  React.useEffect(() => {
    let fn = () => {
      socket.emit("notebook", notebook);
    };
    socket.on("connect", fn);
    return () => {
      socket.off("connect", fn);
    };
  }, [notebook, socket]);

  let last_sent_notebook = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (isEqual(last_sent_notebook.current, notebook)) return;
    last_sent_notebook.current = notebook;

    socket.emit("notebook", notebook);
  }, [notebook, socket]);

  return engine;
};
