import chalk from "chalk";
import { omit, compact, without } from "lodash-es";

import {
  cells_to_dag,
  collect_downstream,
  cyclical_groups,
  double_definitions,
  expand_dag,
  GraphCell,
  topological_sort,
} from "../leaf/dag-things.js";

import { parse_cell } from "../leaf/parse-cell.js";
import serialize from "./serialize.js";
import { Engine, Notebook } from "../types.js";

export let topological_sort_notebook = (notebook: Notebook) => {
  let graph_cells = notebook_to_graph_cell(notebook);
  let dag = expand_dag(cells_to_dag(graph_cells));
  let sorted = topological_sort(dag);
  return sorted.map((id) => notebook.cells[id]);
};

let cells_that_need_running = (notebook: Notebook, engine: Engine) => {
  let graph_cells = notebook_to_graph_cell(notebook);
  let dag = expand_dag(cells_to_dag(graph_cells));
  let sorted = topological_sort(dag);

  // MULTIPLE DEFINITIONS
  // TODO Move this to a separate step?
  let doubles = double_definitions(graph_cells);
  sorted = without(
    sorted,
    ...doubles.flatMap(([variable_name, cells]) => cells.map((x) => x.id))
  );
  for (let [variable_name, cells] of doubles) {
    let error_message = `Variable ${variable_name} is defined multiple times`;
    let error = new Error(error_message);
    error.stack = "";

    for (let cell of cells) {
      // TODO onChange?
      engine.cylinders[cell.id].result = {
        type: "throw",
        value: serialize(error, globalThis),
      };
    }
  }

  // CYCLICAL DEPENDENCIES
  // TODO Move this to a separate step?
  // let cyclicals = cyclical_groups(dag);
  // console.log(`cyclicals:`, cyclicals);
  // sorted = without(sorted, ...cyclicals.flat());
  // for (let group of cyclicals) {
  //   let error_message = `Cyclical dependency: ${group.join(" -> ")}`;
  //   let error = new Error(error_message);
  //   error.stack = "";

  //   for (let cell_id of group) {
  //     // TODO onChange?
  //     engine.cylinders[cell_id].result = {
  //       type: "throw",
  //       value: serialize(error, global),
  //     };
  //   }
  // }

  let deleted_cells = [];
  for (let cylinder of Object.values(engine.cylinders)) {
    if (cylinder.id in notebook.cells === false) {
      deleted_cells.push(cylinder.id);
    }
  }

  let cell_should_run_at_map = {};
  let cells_that_should_run = [];
  for (let deleted_cell of deleted_cells) {
    cell_should_run_at_map[deleted_cell] = Infinity;
    cells_that_should_run.push(deleted_cell);
  }
  for (let cell_id of sorted) {
    let cell = notebook.cells[cell_id];
    let cylinder = engine.cylinders[cell_id];

    if (cell.last_run == null) {
      // Eh?
      continue;
    }

    // No last_run? Definitely should run!!
    if (cylinder?.last_run == null) {
      throw new Error("Shouldn't happen!");
      cell_should_run_at_map[cell_id] = Infinity;
      cells_that_should_run.push(cell_id);
      continue;
    }

    // Cell has been sent to be re-run, also run it!
    if ((cell.last_run ?? -Infinity) > (cylinder.last_run ?? -Infinity)) {
      cell_should_run_at_map[cell_id] = Infinity;
      cells_that_should_run.push(cell_id);
      continue;
    }

    // Here comes the tricky part: I need to "carry over" the `should_run` times from the parent cells.
    let should_run_at = Math.max(
      cylinder.last_internal_run,
      ...dag[cell_id].in.map((parent_id) => cell_should_run_at_map[parent_id]),
      ...cylinder.upstream_cells.map(
        (parent_id) => cell_should_run_at_map[parent_id] ?? Infinity
      )
    );
    cell_should_run_at_map[cell_id] = should_run_at;

    if (should_run_at > cylinder.last_internal_run) {
      cells_that_should_run.push(cell_id);
    }
  }

  return cells_that_should_run;
};

let notebook_to_graph_cell = (notebook: Notebook): GraphCell[] => {
  return compact(
    notebook.cell_order.map((cell_id) => {
      let cell = notebook.cells[cell_id];

      if (cell.type === "text") {
        return null;
      }

      let parsed = parse_cell(cell);
      if ("output" in parsed) {
        return {
          id: cell_id,
          exports: parsed.output.meta.created_names,
          imports: parsed.output.meta.consumed_names,
        };
      } else {
        return {
          id: cell_id,
          exports: [],
          imports: [],
        };
      }
    })
  );
};

let try_with_default = (fn, def) => {
  try {
    return fn();
  } catch (error) {
    console.log(
      chalk.red.bold`Couldn't serialize error:`,
      chalk.red(error.stack)
    );
    return def;
  }
};

export type ExecutionResult<T = any, E = any> =
  | { type: "return"; value: T }
  | { type: "throw"; value: E };

export let notebook_step = async ({
  engine,
  notebook,
  filename,
  onChange,
  run_cell,
}: {
  engine: Engine;
  filename: string;
  notebook: Notebook;
  onChange: (mutate: (engine: Engine) => void) => void;
  run_cell: (options: {
    signal: AbortSignal;
    code: string;
    inputs: { [key: string]: any };
  }) => Promise<{ result: ExecutionResult }>;
}) => {
  let graph_cells = notebook_to_graph_cell(notebook);
  let dag = expand_dag(cells_to_dag(graph_cells));

  let cells_to_run = cells_that_need_running(notebook, engine);
  // TODO Mark every `cells_to_run` as pending!

  for (let cylinder of Object.values(engine.cylinders)) {
    let should_be_waiting = cells_to_run.includes(cylinder.id);
    if (cylinder.waiting !== should_be_waiting) {
      onChange((engine) => {
        engine.cylinders[cylinder.id].waiting = should_be_waiting;
      });
    }
  }

  let cell_to_run = cells_to_run[0];

  // let cell_to_run = get_next_cell_to_run(engine, notebook);
  if (cell_to_run != null) {
    let key = cell_to_run;
    let cell = notebook.cells[key];

    // Cell has been deleted!
    // Gently ask it to stop existing and move on.
    if (cell == null) {
      await engine.cylinders[cell_to_run].abort_controller?.abort();
      onChange(() => {
        delete engine.cylinders[cell_to_run];
      });
      return;
    }

    let parsed = parse_cell(cell);

    onChange((engine) => {
      engine.cylinders[key] = {
        ...engine.cylinders[key],
        last_run: cell.last_run,
        last_internal_run: engine.internal_run_counter++,
        upstream_cells: dag[key].in,
        running: true,
        waiting: false,
      };
    });

    let cylinder = engine.cylinders[key];
    if ("error" in parsed) {
      let _parsed = parsed;
      // Error while parsing the code, so we run it to get the javascript error
      onChange(() => {
        engine.cylinders[key] = {
          ...engine.cylinders[key],
          last_run: cell.last_run,
          result: {
            type: "throw",
            value: serialize(_parsed.error, globalThis),
          },
          running: false,
          waiting: false,
          upstream_cells: [],
          variables: {},
        };
      });
      return;
    }
    if (!("output" in parsed)) {
      onChange((engine) => {
        engine.cylinders[key] = {
          ...engine.cylinders[key],
          last_run: cell.last_run,
          result: {
            type: "throw",
            value: serialize(new Error("Something is wronnnggggg"), globalThis),
          },
          running: false,
          upstream_cells: [],
          variables: {},
        };
      });
      return;
    }

    let {
      code,
      meta: { consumed_names, last_created_name, has_top_level_return },
    } = parsed.output;

    if (has_top_level_return) {
      onChange((engine) => {
        engine.cylinders[key] = {
          ...engine.cylinders[key],
          last_run: cell.last_run,
          result: {
            type: "throw",
            value: serialize(
              new Error("Top level return statements are not allowed"),
              global
            ),
          },
          running: false,
          upstream_cells: [],
          variables: {},
        };
      });
      return;
    }

    console.log(chalk.blue.bold`RUNNING CODE:`);
    console.log(chalk.blue(code));

    // Look for request variable names in other cylinders
    let inputs = {} as { [key: string]: any };
    for (let name of consumed_names) {
      for (let cylinder of Object.values(engine.cylinders)) {
        if (name in (cylinder.variables ?? {})) {
          inputs[name] = cylinder.variables[name];
        }
      }
    }

    // If there was a previous run, allow performing cleanup.
    // TODO Ideally this has a nicer abstraction.
    cylinder.abort_controller?.abort();
    // Wait a tick
    await new Promise((resolve) => setTimeout(resolve, 0));
    let abort_controller = new AbortController();
    cylinder.abort_controller = abort_controller;

    let { result } = await run_cell({
      signal: abort_controller.signal,
      code: code,
      inputs: inputs,
    });

    onChange((engine) => {
      engine.cylinders[key] = {
        ...engine.cylinders[key],
        result:
          result.type === "return"
            ? {
                type: "return",
                name: last_created_name,
                value: try_with_default(
                  () => serialize(result.value?.default, globalThis),
                  { 0: { type: `couldn't serialize` } }
                ),
              }
            : result.type === "throw"
            ? {
                type: "throw",
                value: try_with_default(
                  () => serialize(result.value, globalThis),
                  {
                    0: { type: `couldn't serialize` },
                  }
                ),
              }
            : { type: "pending" },
        running: false,
        variables:
          result.type === "return" ? omit(result.value, "default") : {},
      };
    });
  }
};
