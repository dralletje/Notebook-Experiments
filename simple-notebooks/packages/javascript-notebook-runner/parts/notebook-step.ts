import { invariant } from "../leaf/invariant.js";

import * as Graph from "../leaf/graph.js";

import { ParsedCells } from "./parse-cache.js";
import { CellId, Notebook } from "../types.js";
import { StacklessError } from "../leaf/StacklessError.js";
import { groupBy, uniq } from "lodash-es";

import { Engine, EngineTime } from "./engine.js";
import { DeepReadonly } from "../leaf/DeepReaonly.js";

let cells_that_need_running = (
  notebook: Notebook,
  engine: DeepReadonly<Engine>,
  graph: Graph.Graph
): CellId[] => {
  let sorted = Graph.topological_sort(graph) as CellId[];

  let cell_should_run_at_map = new Map<CellId, EngineTime>();
  let cells_that_should_run: CellId[] = [];
  for (let cell_id of sorted) {
    let cell = notebook.cells[cell_id];
    let cylinder = engine.cylinders.get(cell_id);

    // prettier-ignore
    invariant(cell.requested_run_time != null, `cell.requested_run_time shouldn't be null`);
    // prettier-ignore
    invariant(cylinder?.last_run != null, `cylinder.last_run shouldn't be null`);

    // Cell has been requested to run explicitly, so just run it!
    if (cell.requested_run_time > cylinder.last_run) {
      cell_should_run_at_map.set(cell_id, EngineTime.LATEST);
      cells_that_should_run.push(cell_id);
      continue;
    }

    // Here comes the tricky part: I need to "carry over" the `should_run` times from the parent cells.
    let should_run_at = EngineTime.latest(
      cylinder.last_internal_run,

      ...graph
        .get(cell_id)
        .in.keys()
        .map((upstream_id: CellId) => {
          if (!cell_should_run_at_map.has(upstream_id)) {
            // Due to how sorting works, if the cell is part of a cyclic chain,
            // we process some of them before we processed their cyclic siblings.
            // There is a check for this later, so we don't have to worry here.
            return EngineTime.EARLIEST;
          } else {
            return cell_should_run_at_map.get(upstream_id);
          }
        }),

      // This is so that when you have
      // CELL_1: a = 10
      // CELL_2: b = a
      // You run them, all fine, but now! You remove CELL_1 (or change it so it doesn't define `a`).
      // How would CELL_2 know to run again? It's not connected the DAG anymore!
      // So I have to remember the cells CELL_2 depended on in the last run,
      // and check if any of those have changed.
      ...cylinder.upstream_cells.map((upstream_id) => {
        if (!engine.cylinders.get(upstream_id)) {
          // Cell was deleted
          return EngineTime.LATEST;
        } else if (
          !cell_should_run_at_map.has(upstream_id) &&
          !graph.get(cell_id).in.has(upstream_id)
        ) {
          // Cell _was_ part of a cyclic chain AND the sibling cell we're looking at isn't part of our cycle
          // anymore, which means it was changed! So we need to run!!
          return EngineTime.LATEST;
        } else {
          // Cell might have executed later, and removed our variable
          return cell_should_run_at_map.get(upstream_id);
        }
      })
    );

    cell_should_run_at_map.set(cell_id, should_run_at);

    if (should_run_at > cylinder.last_internal_run) {
      cells_that_should_run.push(cell_id);
    }
  }

  return cells_that_should_run;
};

export let notebook_to_disconnected_graph = (
  parsed_cells: ParsedCells
): Graph.DisconnectedGraph => {
  return Object.entries(parsed_cells).map(([cell_id, parsed_cell]) => {
    let parsed = parsed_cells[cell_id];
    if (parsed != null && "output" in parsed) {
      return {
        id: cell_id as CellId,
        exports: parsed.output.meta.output as Graph.EdgeName[],
        imports: parsed.output.meta.input as Graph.EdgeName[],
      };
    } else {
      return {
        id: cell_id as CellId,
        exports: [],
        imports: [],
      };
    }
  });
};

export type ExecutionResult<T = any, E = any> =
  | { type: "return"; value: T }
  | { type: "throw"; value: E };

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
 * TODO? Maybe split up the syntax stuff from the cycles/multiple definitions stuff?
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
    cycle.some(([cell_id]) => cells_to_run.includes(cell_id as CellId))
      ? cycle.map(([cell_id]) => cell_id)
      : []
  );

  let multiple_definitions = Graph.multiple_definitions(graph);

  return uniq([...cells_to_run, ...cycles_to_run]).flatMap(
    (cell_id: CellId) => {
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
        let joined = Array.from(multiple_definitions.get(cell_id)).join(", ");
        return {
          type: "error",
          cell_id: cell_id,
          // prettier-ignore
          error: new StacklessError(`Multiple definitions of ${joined}`),
        };
      } else if (
        cyclicals.some((group) => group.some(([x]) => x === cell_id))
      ) {
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
    }
  );
};

export let notebook_step = ({
  engine,
  notebook,
  filename,
  onChange,
}: {
  engine: DeepReadonly<Engine>;
  filename: string;
  notebook: Notebook;
  onChange: (mutate: (engine: Engine) => void) => void;
}) => {
  // prettier-ignore
  invariant(
    engine.cylinders.values().filter((cylinder) => cylinder.running).toArray().length === 0,
    "There are cells currently running!"
  );

  /////////////////////////////////////
  // Start parsing and analysing
  /////////////////////////////////////

  let parsed_cells = engine.parse_cache.parse_notebook(notebook.cells);

  let graph = Graph.inflate_compact_graph(
    Graph.disconnected_to_compact_graph(
      notebook_to_disconnected_graph(parsed_cells)
    )
  );

  let cells_to_run = cells_that_need_running(notebook, engine, graph);

  let analysis_results = get_analysis_results(
    cells_to_run,
    parsed_cells,
    graph
  );

  let by_status: {
    static: (StaticResult & { type: "static" })[];
    fine: (StaticResult & { type: "fine" })[];
    error: (StaticResult & { type: "error" })[];
  } = {
    static: [],
    fine: [],
    error: [],
    ...(groupBy(analysis_results, (result) => result.type) as any),
  };

  // if (by_status.error.length > 0) {
  //   onLog({
  //     title: "Disabling cells because of errors",
  //     cells: [...by_status.error.map((x) => x.cell_id)],
  //   });
  // }
  for (let error_cell of by_status.error) {
    let { cell_id, error } = error_cell;
    let cell = notebook.cells[cell_id];
    let graph_entry = graph.get(cell_id);

    onChange((engine) => {
      Object.assign(engine.cylinders.get(cell_id), {
        last_run: cell.requested_run_time,
        last_internal_run: engine.tick(),
        result: { type: "throw", value: error },
        running: false,
        waiting: false,
        upstream_cells: Array.from(graph_entry.in.keys()) as CellId[],
        variables: {},
      });
    });
  }

  for (let fine_cell of by_status.fine) {
    let cylinder = engine.cylinders.get(fine_cell.cell_id);
    if (!cylinder.waiting) {
      onChange((engine) => {
        engine.cylinders.get(cylinder.id).waiting = true;
      });
      continue;
    }
  }

  /////////////////////////////////////
  // Find next cell to run
  /////////////////////////////////////

  // If there is no cell that needs running, we're done!
  if (by_status.fine.length === 0) return;

  // By default just run the first (topologically sorted)
  let cell_to_run = by_status.fine[0].cell_id;

  // Additionally, find all cells that can run now (have no pending upstream cells)
  // and find the one that was requested to run the shortest time ago
  let cells_that_can_run = by_status.fine.filter(({ cell_id }) => {
    let graph_node = graph.get(cell_id);
    return by_status.fine.every((possibly_upstream) => {
      return !graph_node.in.has(possibly_upstream.cell_id);
    });
  });
  for (let { cell_id } of cells_that_can_run) {
    if (
      // Has the cell been requested to run, or is it running because of upstream
      notebook.cells[cell_id].requested_run_time !==
        engine.cylinders.get(cell_id).last_run &&
      // Is the cell requested to run earlier than the current cell to run
      notebook.cells[cell_id].requested_run_time >
        notebook.cells[cell_to_run].requested_run_time
    ) {
      cell_to_run = cell_id;
    }
  }

  return { cell_id: cell_to_run, graph_node: graph.get(cell_to_run) };
};
