import React from "react";
import { produce as immer, original } from "immer";
import { isEqual } from "lodash";
import { AddLogEvent, Engine, UpdateEngineEvent } from "./Environment";

/**
 * @param {{
 *  target: EventTarget;
 *  type: string;
 *  listener: (e: any) => void;
 * }} props
 * @param {React.DependencyList} deps
 */
let useEventListener = ({ target, type, listener }, deps) => {
  React.useEffect(() => {
    target.addEventListener(type, listener);
    return () => {
      target.removeEventListener(type, listener);
    };
  }, [target, ...deps]);
};

/**
 * @param {{
 *  filename: string;
 *  notebook: import("../packages/codemirror-notebook/cell.js").NotebookSerialized;
 * }} notebook
 * @param {import("./Environment.js").Environment} environment
 * @returns {[
 *  import("../packages/codemirror-notebook/cell.js").EngineShadow,
 *  import("./Environment.js").EngineLog[],
 *  any,
 * ]}
 */
export let useEngine = (notebook, environment) => {
  let [state, set_state] = React.useState(
    /**
     * @type {{
     *  engine: import("../packages/codemirror-notebook/cell.js").EngineShadow,
     *  logs: import("./Environment.js").EngineLog[],
     * }}
     */
    ({ engine: { cylinders: {} }, logs: [] })
  );

  let engine = React.useMemo(() => environment.createEngine(), []);

  // Start the engine!
  React.useEffect(() => {
    engine.start();
    return () => {
      // Clear logs as well
      set_state({ engine: { cylinders: {} }, logs: [] });
      engine.stop();
    };
  }, []);

  useEventListener(
    {
      target: engine,
      type: "update-engine",
      listener: (/** @type {UpdateEngineEvent} */ event) => {
        let engine = event.engineShadow;
        set_state(
          immer((x) => {
            x.engine = engine;
          })
        );
      },
    },
    [engine, set_state]
  );

  useEventListener(
    {
      target: engine,
      type: "add-log",
      listener: (/** @type {AddLogEvent} */ event) => {
        /** @type {Omit<import("./Environment.js").EngineLog, "cell">} */
        let log = event.log;
        set_state(
          immer((x) => {
            // @ts-ignore
            let previous_log = x.logs.at(-1);

            if (x.engine.cylinders[log.cell_id] == null) {
              console.warn(`Log came back with cylinder ID we don't have yet`);
              return;
            }

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
            ].slice(-50, undefined);
          })
        );
      },
    },
    [engine, set_state]
  );

  let last_sent_notebook = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (isEqual(last_sent_notebook.current, notebook)) return;
    last_sent_notebook.current = notebook;

    engine.update_notebook(notebook.notebook);
  }, [notebook]);

  let engine_shadow_with_deserialize = React.useMemo(() => {
    return {
      ...state.engine,
      deserialize: (value) => {
        return engine.deserialize(value);
      },
    };
  }, [state.engine, engine.deserialize]);

  return [engine_shadow_with_deserialize, state.logs, engine.deserialize];
};

/** @returns {import("../packages/codemirror-notebook/cell").CylinderShadow} */
export let default_cylinder = () => {
  return {
    last_run: -Infinity,
    last_internal_run: 0,
    result: { type: "return", value: { 0: { type: "undefined", value: "" } } },
    running: false,
    waiting: false,
  };
};
