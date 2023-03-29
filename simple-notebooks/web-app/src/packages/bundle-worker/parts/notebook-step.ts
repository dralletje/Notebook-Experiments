import chalk from "chalk";
import { omit, compact, without } from "lodash-es";
import { invariant } from "../leaf/invariant";

import * as Graph from "../leaf/graph.js";

import { parse_cell, ParsedCell } from "../leaf/parse-cell.js";
import { CellId, Engine, Notebook } from "../types.js";
import { StacklessError } from "../leaf/StacklessError.js";
import { mapValues, groupBy, uniq } from "lodash-es";

type ParsedCells = { [key: CellId]: ParsedCell | null };

let cells_that_need_running = (
  notebook: Notebook,
  engine: Engine,
  graph: Graph.Graph
): CellId[] => {
  let sorted = Graph.topological_sort(graph);

  let cell_should_run_at_map = {};
  let cells_that_should_run = [];
  for (let cell_id of sorted) {
    let cell = notebook.cells[cell_id];
    let cylinder = engine.cylinders[cell_id];

    invariant(cell.last_run != null, `cell.last_run shouldn't be null`);
    invariant(cylinder?.last_run != null, `cell.last_run shouldn't be null`);

    // Cell has been sent to be re-run, also run it!
    if (cell.last_run > cylinder.last_run) {
      cell_should_run_at_map[cell_id] = Infinity;
      cells_that_should_run.push(cell_id);
      continue;
    }

    // Here comes the tricky part: I need to "carry over" the `should_run` times from the parent cells.
    let should_run_at = Math.max(
      cylinder.last_internal_run,
      ...graph[cell_id].in.map(
        ([parent_id]) => cell_should_run_at_map[parent_id]
      ),

      // This is so that when you have
      // CELL_1: a = 10
      // CELL_2: b = a
      // You run them, all fine, but now! You remove CELL_1 (or change it so it doesn't define `a`).
      // How would CELL_2 know to run again? It's not connected the DAG anymore!
      // So I have to remember the cells CELL_2 depended on in the last run,
      // and check if any of those have changed.
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

let notebook_to_disconnected_graph = (
  cell_order: CellId[],
  parsed_cells: ParsedCells
): Graph.DisconnectedGraph => {
  return cell_order.map((cell_id, parsed_cell) => {
    let parsed = parsed_cells[cell_id];
    if (parsed != null && "output" in parsed) {
      return {
        id: cell_id,
        exports: parsed.output.meta.output,
        imports: parsed.output.meta.input,
      };
    } else {
      return {
        id: cell_id,
        exports: [],
        imports: [],
      };
    }
  });
};

export type ExecutionResult<T = any, E = any> =
  | { type: "return"; value: T }
  | { type: "throw"; value: E };

/** Gets the cells' ParsedCell, but with smart caching */
let parse_all_cells = (
  engine: Engine,
  notebook: Notebook
): { [key: CellId]: ParsedCell } => {
  let parse_cache = engine.parse_cache;
  return mapValues(notebook.cells, (cell) => {
    if (cell.type === "text") {
      return {
        input: cell.code,
        static: cell.code,
      };
    } else if (parse_cache.get(cell.id)?.input === cell.code) {
      return parse_cache.get(cell.id);
    } else {
      let parsed = parse_cell(cell);
      parse_cache.set(cell.id, parsed);
      return parsed;
    }
  });
};

type StaticResult =
  | { type: "fine"; cell_id: CellId }
  | { type: "static"; cell_id: CellId }
  | { type: "error"; cell_id: CellId; error: Error };

/**
 * Get some early results from static analysis:
 * - Show errors for syntax errors
 * - Do nothing for cells that are just markdown
 * - Find cycles and multiple definitions
 *
 * TODO Maybe split up the syntax stuff from the cycles/multiple definitions stuff?
 */
let get_analysis_results = (
  cells_to_run: CellId[],
  parsed_cells: ParsedCells,
  graph: Graph.Graph
): StaticResult[] => {
  let cyclicals = Graph.cycles(graph);
  // Hack to put cycles in, as they work weird so don't work nicely with
  // the "what cells to run" logic.
  let cycles_to_run = cyclicals.flatMap((cycle) =>
    cycle.some(([cell_id]) => cells_to_run.includes(cell_id))
      ? cycle.map(([cell_id]) => cell_id)
      : []
  );

  let multiple_definitions = Graph.double_definitions(graph);

  return uniq([...cells_to_run, ...cycles_to_run]).flatMap((cell_id) => {
    let parsed = parsed_cells[cell_id];
    // Error while parsing the code, so we display babel error
    if ("error" in parsed) {
      return {
        type: "error",
        cell_id: cell_id,
        error: new StacklessError(parsed.error),
      };
    } else if (!("output" in parsed)) {
      // prettier-ignore
      invariant(parsed.static != null, `parsed.static shouldn't be null when parsed.output is null`);
      return {
        type: "static",
        cell_id,
      };
    } else if (parsed.output.meta.has_top_level_return) {
      return {
        type: "error",
        cell_id: cell_id,
        // prettier-ignore
        error: new StacklessError("Top level return statements are not allowed"),
      };
    } else if (multiple_definitions.has(cell_id)) {
      return {
        type: "error",
        cell_id: cell_id,
        // prettier-ignore
        error: new StacklessError(`Multiple definitions of ${multiple_definitions.get(cell_id).join(", ")}`),
      };
    } else if (cyclicals.some((group) => group.some(([x]) => x === cell_id))) {
      let my_cycles = cyclicals
        .filter((group) => group.some(([x]) => x === cell_id))
        .map((cycle) => {
          // Find this cell in the cycle, and then start it from there
          let start_index = cycle.findIndex(([x]) => x === cell_id);
          return [
            ...cycle.slice(start_index),
            ...cycle.slice(0, start_index),
            cycle[start_index],
          ];
        });

      let my_cycles_text = my_cycles
        .map(
          (x) =>
            "(" + x.map(([x, { name }]) => `\`${name}\``).join(" -> ") + ")"
        )
        .join(", ");

      // prettier-ignore
      return {
        type: "error",
        cell_id: cell_id,
        error: new StacklessError(`Cyclical dependency ${my_cycles_text}`),
      };
    } else {
      return {
        type: "fine",
        cell_id,
      };
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
  // prettier-ignore
  invariant(
    Object.values(engine.cylinders).filter((cylinder) => cylinder.running).length === 0,
    "There are cells currently running!"
  );

  // "Just" run all handlers for deleted cells
  // TODO? I just know this will bite me later
  // TODO Wrap abort controller handles so I can show when they go wrong
  let deleted_cells = Object.values(engine.cylinders).filter((cylinder) => {
    return cylinder.id in notebook.cells === false;
  });
  for (let deleted_cell of deleted_cells) {
    deleted_cell.abort_controller.abort();
    onChange(() => {
      delete engine.cylinders[deleted_cell.id];
    });
  }

  /////////////////////////////////////
  // Start parsing and analysing
  /////////////////////////////////////

  let parsed_cells = parse_all_cells(engine, notebook);

  let graph = Graph.inflate_compact_graph(
    Graph.disconnected_to_compact_graph(
      notebook_to_disconnected_graph(notebook.cell_order, parsed_cells)
    )
  );

  let cells_to_run = cells_that_need_running(notebook, engine, graph);

  let analysis_results = get_analysis_results(
    cells_to_run,
    parsed_cells,
    graph
  );

  let by_status: {
    static: StaticResult[];
    fine: StaticResult[];
    error: StaticResult[];
  } = groupBy(analysis_results, (result) => result.type) as any;

  for (let error_cell of by_status.error ?? []) {
    // Typescript....
    if (error_cell.type !== "error") throw new Error("UGH");

    let { cell_id, error } = error_cell;
    let cell = notebook.cells[cell_id];
    let graph_entry = graph[cell_id];

    onChange((engine) => {
      engine.cylinders[cell_id] = {
        ...engine.cylinders[cell_id],
        last_run: cell.last_run,
        last_internal_run: engine.internal_run_counter++,
        result: { type: "throw", value: error },
        running: false,
        waiting: false,
        upstream_cells: graph_entry.in.map(([id]) => id) ?? [],
        variables: {},
      };
    });
  }

  for (let fine_cell of by_status.fine ?? []) {
    let cylinder = engine.cylinders[fine_cell.cell_id];
    if (!cylinder.waiting) {
      onChange((engine) => {
        engine.cylinders[cylinder.id].waiting = true;
      });
      continue;
    }
  }

  /////////////////////////////////////
  // Start running next cell
  /////////////////////////////////////

  // Just take the first cell to run,
  // could use a cool algorithm to pick the "best" one
  let cell_to_run = by_status.fine?.[0]?.cell_id;

  // If there is no cell that needs running, we're done!
  if (cell_to_run == null) return;

  let key = cell_to_run;
  let cell = notebook.cells[key];
  let parsed = parsed_cells[cell.id];
  if (!("output" in parsed)) {
    throw new Error(`Parsed error shouldn't end up here`);
  }

  onChange((engine) => {
    engine.cylinders[key] = {
      ...engine.cylinders[key],
      last_run: cell.last_run,
      last_internal_run: engine.internal_run_counter++,
      upstream_cells: graph[key].in.map(([id]) => id) ?? [],
      running: true,
      waiting: false,
    };
  });
  let cylinder = engine.cylinders[key];

  let {
    code,
    meta: { input: consumed_names, last_created_name },
  } = parsed.output;

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