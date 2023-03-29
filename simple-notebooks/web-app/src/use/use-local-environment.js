import React from "react";
import { get_bundle_worker } from "../packages/bundle-worker/bundle-worker.js";

/**
 * @param {{
 *  filename: string;
 *  notebook: import("../packages/codemirror-notebook/cell.js").NotebookSerialized;
 * }} notebook
 * @returns {import("../packages/codemirror-notebook/cell.js").EngineShadow}
 */
export let useLocalEnvironment = (notebook) => {
  let [engine, set_engine] = React.useState({ cylinders: {} });

  let bundle_worker = React.useMemo(() => {
    return get_bundle_worker();
  }, []);
  React.useEffect(() => {
    return () => {
      bundle_worker.terminate();
    };
  }, []);

  React.useEffect(() => {
    let handler = (event) => {
      if (event.data.type === "update-engine") {
        set_engine(event.data.engine);
      }
    };

    bundle_worker.addEventListener("message", handler);
    return () => {
      bundle_worker.removeEventListener("message", handler);
    };
  }, [bundle_worker, set_engine]);

  React.useEffect(() => {
    bundle_worker.postMessage({
      type: "update-notebook",
      notebook: notebook.notebook,
    });
  }, [notebook]);
  // React.useEffect(() => {
  //   if (!socket.connected) {
  //     socket.connect();
  //   }
  //   return () => {
  //     socket.close();
  //   };
  // }, [socket]);
  return engine;
};
