import React from "react";
import { get_bundle_worker } from "../packages/bundle-worker/bundle-worker.js";
import immer, { original } from "immer";

/**
 * @typedef EngineLog
 * @type {{
 *  id: string;
 *  cell_id:string;
 *  code: string;
 *  cylinder: import("../packages/codemirror-notebook/cell.js").CylinderShadow,
 * }}
 */

/**
 * @param {{
 *  filename: string;
 *  notebook: import("../packages/codemirror-notebook/cell.js").NotebookSerialized;
 * }} notebook
 * @returns {[import("../packages/codemirror-notebook/cell.js").EngineShadow, EngineLog[]]}
 */
export let useLocalEnvironment = (notebook) => {
  let [state, set_state] = React.useState(
    /**
     * @type {{
     *  engine: import("../packages/codemirror-notebook/cell.js").EngineShadow,
     *  logs: EngineLog[],
     * }}
     */
    ({ engine: { cylinders: {} }, logs: [] })
  );

  let bundle_worker = React.useMemo(() => {
    return get_bundle_worker();
  }, []);
  React.useEffect(() => {
    return () => {
      set_state({ engine: { cylinders: {} }, logs: [] });
      bundle_worker.terminate();
    };
  }, []);

  React.useEffect(() => {
    let handler = (event) => {
      if (event.data.type === "update-engine") {
        set_state(
          immer((x) => {
            x.engine = event.data.engine;
          })
        );
      }
    };

    bundle_worker.addEventListener("message", handler);
    return () => {
      bundle_worker.removeEventListener("message", handler);
    };
  }, [bundle_worker, set_state]);

  React.useEffect(() => {
    let handler = (event) => {
      if (event.data.type === "add-log") {
        /** @type {Omit<EngineLog, "cell">} */
        let log = event.data.log;
        set_state(
          immer((x) => {
            let actual_cylinder = x.engine.cylinders[log.cell_id];
            let new_cylinder = {
              ...actual_cylinder,
              result:
                actual_cylinder.waiting || actual_cylinder.running
                  ? undefined
                  : actual_cylinder.result,
            };
            x.logs = [
              ...x.logs.filter((x) => x.id !== log.id),
              {
                ...log,
                cylinder: new_cylinder,
              },
            ];
          })
        );
      }
    };
    bundle_worker.addEventListener("message", handler);
    return () => {
      bundle_worker.removeEventListener("message", handler);
    };
  }, [bundle_worker, set_state]);

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
  return [state.engine, state.logs];
};
