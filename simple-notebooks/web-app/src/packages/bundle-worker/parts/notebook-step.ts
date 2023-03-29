import chalk from "chalk";
import { omit, compact, without } from "lodash-es";

import {
  cells_to_dag,
  collect_downstream,
  cyclical_groups,
  double_definitions,
  expand_dag,
  ExpandedDAG,
  GraphCell,
  topological_sort,
} from "../leaf/dag-things.js";

import { parse_cell, ParsedCell } from "../leaf/parse-cell.js";
import { CellId, Engine, Notebook } from "../types.js";
import { StacklessError } from "../leaf/StacklessError.js";
import { mapValues } from "lodash-es";
import { analyse_notebook } from "./static-analysis.js";

type ParsedCells = { [key: CellId]: ParsedCell | null };

export let topological_sort_notebook = (
  notebook: Notebook,
  dag: ExpandedDAG
) => {
  let sorted = topological_sort(dag);
  return sorted.map((id) => notebook.cells[id]);
};

let cells_that_need_running = (
  notebook: Notebook,
  engine: Engine,
  dag: ExpandedDAG,
  graph_cells: GraphCell[]
): CellId[] => {
  let sorted = topological_sort(dag);

  // MULTIPLE DEFINITIONS
  // TODO Move this to a separate step?
  let doubles = double_definitions(Object.values(graph_cells));
  sorted = without(
    sorted,
    ...doubles.flatMap(([variable_name, cells]) => cells.map((x) => x.id))
  );
  for (let [variable_name, cells] of doubles) {
    for (let cell of cells) {
      // TODO onChange?
      engine.cylinders[cell.id].result = {
        type: "throw",
        // prettier-ignore
        value: new StacklessError(`Variable ${variable_name} is defined multiple times`),
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
  //       value: error,
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

let notebook_to_graph_cell = (
  cell_order: CellId[],
  parsed_cells: ParsedCells
): GraphCell[] => {
  return compact(
    cell_order.map((cell_id, parsed_cell) => {
      let parsed = parsed_cells[cell_id];
      if (parsed != null && "output" in parsed) {
        return {
          id: cell_id,
          exports: parsed.output.meta.output,
          imports: parsed.output.meta.input,
        };
      } else {
        return null;
      }
    })
  );
};

export type NotebookCache = Map<symbol, any>;

export type ExecutionResult<T = any, E = any> =
  | { type: "return"; value: T }
  | { type: "throw"; value: E };

let parse_all_cells = (
  engine: Engine,
  notebook: Notebook
): { [key: CellId]: ParsedCell } => {
  let parse_cache = engine.parse_cache;
  return mapValues(notebook.cells, (cell) => {
    if (cell.type === "text") {
      return null;
    } else if (parse_cache.get(cell.id)?.input === cell.code) {
      return parse_cache.get(cell.id);
    } else {
      let parsed = parse_cell(cell);
      parse_cache.set(cell.id, parsed);
      return parsed;
    }
  });
};

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
  let parsed_cells = parse_all_cells(engine, notebook);
  // let analysis_result = analyse_notebook(notebook, parsed_cells);

  let graph_cells = notebook_to_graph_cell(notebook.cell_order, parsed_cells);
  let dag = expand_dag(cells_to_dag(graph_cells));

  let cells_to_run = cells_that_need_running(
    notebook,
    engine,
    dag,
    graph_cells
  );

  // Set every cell that needs to run to `.waiting = true`
  for (let cylinder of Object.values(engine.cylinders)) {
    let should_be_waiting = cells_to_run.includes(cylinder.id);
    if (cylinder.waiting !== should_be_waiting) {
      onChange((engine) => {
        engine.cylinders[cylinder.id].waiting = should_be_waiting;
      });
    }
  }

  // Just take the first cell to run,
  // could use a cool algorithm to pick the "best" one
  let cell_to_run = cells_to_run[0];

  // If there is no cell that needs running, we're done!
  if (cell_to_run == null) return;

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

  let parsed = parsed_cells[cell.id];

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
          value: new StacklessError(_parsed.error),
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
          value: new StacklessError("Something is wronnnggggg"),
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
    meta: { input: consumed_names, last_created_name, has_top_level_return },
  } = parsed.output;

  if (has_top_level_return) {
    onChange((engine) => {
      engine.cylinders[key] = {
        ...engine.cylinders[key],
        last_run: cell.last_run,
        result: {
          type: "throw",
          value: new StacklessError(
            "Top level return statements are not allowed"
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
          ? { ...result, name: last_created_name }
          : result,
      running: false,
      variables: result.type === "return" ? omit(result.value, "default") : {},
    };
  });
};
