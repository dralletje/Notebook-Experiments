import process from "node:process";

import { mapValues, throttle } from "lodash-es";

import serialize from "../serialize.js";
import { notebook_step, topological_sort_notebook } from "../notebook-step.js";

export type DAGElement = {
  id: CellId;
  in: DAGElement[];
  out: DAGElement[];
};

type Result<T, E> =
  | { type: "return"; name?: string; value: T }
  | { type: "throw"; value: E }
  | { type: "pending" };

type Serialized = { [id: number]: { type: string; value: any } };

export type CellId = string;

export type Engine = {
  cylinders: { [cell_id: CellId]: Cylinder };
  internal_run_counter: number;
  dag: { [key: CellId]: DAGElement };
  is_busy: boolean;
};

export type Cylinder = {
  id: CellId;
  name: string;
  last_run: number;
  last_internal_run: number;
  running: boolean;
  waiting: boolean;
  result: Result<Serialized, Serialized>;
  variables: { [name: string]: any };
  upstream_cells: Array<CellId>;
  invalidation_token: { call: () => Promise<any> };
};

export type Notebook = {
  cells: { [key: CellId]: Cell };
  cell_order: CellId[];
};

export type Workspace = {
  files: { [filename: string]: { filename: string; notebook: Notebook } };
};
export type WorkspaceEngine = {
  files: { [filename: string]: Engine };
};

export type Cell = {
  code: string;
  type: "code" | "text";
  last_run: number;
  id: CellId;
};

let run_notebook = async (
  filename: string,
  notebook_ref: { current: Notebook },
  engine: Engine,
  onChange: (engine: Engine) => void
) => {
  let onChange_debounced = throttle(onChange, 0);

  let did_change = true;
  while (did_change === true) {
    did_change = false;

    // @ts-ignore
    // parse_all_cells(notebook_ref.current, engine);
    // let dag = cells_to_dag(notebook, engine);
    // engine.dag = dag;
    // return engine;

    for (let [cell_id, cell] of Object.entries(notebook_ref.current.cells)) {
      engine.cylinders[cell_id] ??= {
        id: cell_id,
        name: cell_id,
        last_run: -Infinity,
        last_internal_run: -Infinity,
        running: false,
        waiting: false,
        result: {
          type: "return",
          value: { 0: { type: "undefined", value: "" } },
        },
        variables: {},
        upstream_cells: [],
        invalidation_token: { call: () => Promise.resolve() },
      };
    }

    await notebook_step(
      engine,
      { filename: filename, notebook: notebook_ref.current },
      (fn) => {
        did_change = true;
        fn(engine);
        onChange_debounced(engine);
      }
    );
    onChange_debounced(engine);
  }
};

let engine_to_json = (engine) => {
  return {
    cylinders: mapValues(engine.cylinders, (cylinder) => ({
      name: cylinder.name,
      result: cylinder.result,
      last_run: cylinder.last_run,
      running: cylinder.running,
      waiting: cylinder.waiting,
    })),
    dag: serialize(engine.dag, global),
  };
};

let engine = {
  cylinders: {},
  internal_run_counter: 1,
  dag: {},
  is_busy: false,
};

let notebook_ref = { current: null as Notebook | null };

type CircuitMessage = {
  type: "update-notebook";
  notebook: Notebook;
};

process.on("message", async (message: CircuitMessage) => {
  if (message.type === "update-notebook") {
    let { notebook } = message;
    // notebook_ref = { current: notebook.notebook };
    notebook_ref.current = notebook;

    if (engine.is_busy) return;
    engine.is_busy = true;

    await run_notebook(
      notebook.filename,
      notebook_ref as any,
      engine,
      (engine) => {
        let x = engine_to_json(engine);
        process.send!({
          type: "update-engine",
          engine: x,
        });
      }
    );
    engine.is_busy = false;
  }
});
