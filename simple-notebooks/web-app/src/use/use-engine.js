import React from "react";

/**
 * @param {{ filename: string, notebook: import("../packages/codemirror-notebook/notebook-types").NotebookSerialized }} notebook
 * @param {import("socket.io-client").Socket} socket
 * @returns {import("../packages/codemirror-notebook/notebook-types").EngineShadow}
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

  React.useEffect(() => {
    socket.emit("notebook", notebook);
  }, [notebook, socket]);

  return engine;
};
