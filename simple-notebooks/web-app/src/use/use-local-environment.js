import React from "react";
import { get_bundle_worker } from "../packages/bundle-worker/bundle-worker.js";
import immer, { original } from "immer";
import { isEqual } from "lodash";

/**
 * @typedef EngineLog
 * @type {{
 *  id: string;
 *  cell_id:string;
 *  code: string;
 *  cylinder: import("../packages/codemirror-notebook/cell.js").CylinderShadow,
 *  repeat: number;
 *  time: Date;
 * }}
 *
 * TODO Use `time` property in log to show "last updated" time
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
            // @ts-ignore
            let previous_log = x.logs.at(-1);
            let actual_cylinder =
              /** @type {import("../packages/codemirror-notebook/cell.js").CylinderShadow} */ (
                original(x.engine.cylinders[log.cell_id])
              );

            if (
              previous_log &&
              previous_log.code === log.code &&
              previous_log.cell_id === log.cell_id &&
              isEqual(previous_log.cylinder.result, actual_cylinder.result)
            ) {
              previous_log.repeat++;
              previous_log.time = new Date();
              return;
            }

            let new_cylinder = {
              ...actual_cylinder,
              result:
                actual_cylinder.waiting || actual_cylinder.running
                  ? undefined
                  : actual_cylinder.result,
            };
            x.logs = [
              // @ts-ignore
              ...x.logs.filter((x) => x.id !== log.id),
              {
                ...log,
                // @ts-ignore
                cylinder: new_cylinder,
                time: new Date(),
                repeat: 1,
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
