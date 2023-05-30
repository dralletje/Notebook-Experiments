import { groupBy, uniq } from "lodash-es";
import { ModernMap } from "@dral/modern-map";
import { invariant } from "@dral/javascript-notebook-runner/dist/leaf/invariant.js";
import { StacklessError } from "@dral/javascript-notebook-runner/dist/leaf/StacklessError.js";

import {
  ParseCache,
  ParsedCells,
} from "@dral/javascript-notebook-runner/dist/blueprint/parse-cache.js";
import { Notebook } from "@dral/javascript-notebook-runner/dist/types.js";

import * as Graph from "@dral/javascript-notebook-runner/dist/leaf/graph.js";
import {
  Blueprint,
  CellId,
  Chamber,
  Mistake,
} from "@dral/javascript-notebook-runner/dist/blueprint/blueprint.js";
import { EdgeName } from "@dral/javascript-notebook-runner/dist/leaf/graph.js";
import { NodeId } from "@dral/javascript-notebook-runner/dist/leaf/graph.js";

let SETUP_ID = "setup" as NodeId;

export let notebook_to_disconnected_graph = (
  parsed_cells: ParsedCells
): Graph.DisconnectedGraph => {
  return [
    {
      id: SETUP_ID,
      exports: [],
      imports: [{ in: "setup" as EdgeName, out: "setup" as EdgeName }],
    },
    ...Object.entries(parsed_cells).map(([cell_id, parsed_cell]) => {
      let parsed = parsed_cells[cell_id];
      if (parsed != null && "output" in parsed) {
        return {
          id: cell_id as CellId,
          exports: [
            ...parsed.output.meta.output,
            // TODO This is a "Hack" to get sheets working
            { in: "default" as Graph.EdgeName, out: cell_id as Graph.EdgeName },
          ],
          imports: parsed.output.meta.input,
        };
      } else {
        return {
          id: cell_id as CellId,
          exports: [],
          imports: [],
        };
      }
    }),
  ];
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
 */
let get_analysis_results = (
  cells_to_run: CellId[],
  parsed_cells: ParsedCells,
  graph: Graph.Graph
): StaticResult[] => {
  let cyclicals = Graph.cycles(graph);
  let multiple_definitions = Graph.multiple_definitions(graph);

  return uniq(cells_to_run).flatMap((cell_id: CellId) => {
    let parsed = parsed_cells[cell_id];

    if (parsed == null) {
      return {
        type: "fine",
        cell_id: cell_id,
      };
    }

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
          (x) => "(" + x.map(([x, edge]) => `\`${edge.in}\``).join(" -> ") + ")"
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

type Externals = {
  input?: { [key: string]: Symbol };
  output?: { [key: string]: Symbol };
};

export class P5Architect {
  private parse_cache: ParseCache = new ParseCache();

  design(
    notebook: Notebook,
    { input = {}, output = {} }: Externals = {}
  ): Blueprint {
    let parsed_cells = this.parse_cache.parse_notebook(notebook.cells);

    let simple_cells: Graph.DisconnectedGraph = [
      ...notebook_to_disconnected_graph(parsed_cells),
      ...Object.entries(output).map(
        ([name, value]) =>
          ({
            id: value as any as NodeId,
            imports: [{ in: name, out: "default" }],
            exports: [],
          } as Graph.DisconnectedNode)
      ),
    ];

    let graph = Graph.inflate_compact_graph(
      Graph.disconnected_to_compact_graph(simple_cells)
    );

    let code_cell_ids = [
      ...notebook.cell_order.filter((x) => notebook.cells[x].type === "code"),
      ...Object.entries(output).map(([name, value]) => value as any as CellId),
    ];

    let analysis_results = get_analysis_results(
      code_cell_ids,
      parsed_cells,
      graph
    );

    let by_status: {
      fine: (StaticResult & { type: "fine" })[];
      error: (StaticResult & { type: "error" })[];
    } = {
      fine: [],
      error: [],
      ...(groupBy(analysis_results, (result) => result.type) as any),
    };

    let chambers = new ModernMap<CellId, Chamber>();
    let mistakes = new ModernMap<CellId, Mistake>();

    for (let result of by_status.error) {
      let cell = notebook.cells[result.cell_id];
      mistakes.set(result.cell_id, {
        id: result.cell_id,
        message: result.error.message,
        node: graph.get(result.cell_id),
        requested_run_time: cell.requested_run_time,
      });
    }

    let output_cell_ids = Object.values(output);
    for (let result of by_status.fine) {
      let cell = notebook.cells[result.cell_id];
      let parsed = parsed_cells[result.cell_id];

      if (output_cell_ids.includes(result.cell_id)) {
        chambers.set(result.cell_id, {
          id: result.cell_id,
          name: "",
          code: "",
          node: graph.get(result.cell_id),
          requested_run_time: 0,
        });
        continue;
      }

      if ("output" in parsed) {
        chambers.set(result.cell_id, {
          id: result.cell_id,
          name: parsed.output.meta.last_created_name,
          code: parsed.output.code,
          node: graph.get(result.cell_id),
          requested_run_time: cell.requested_run_time,
        });
      }
    }

    let arrangement = [
      ...Graph.topological_sort(graph).map((cell_id) => cell_id as CellId),
    ];

    let x = {
      chambers: new ModernMap(
        arrangement
          .filter((cell_id) => chambers.has(cell_id))
          .map((cell_id) => [cell_id, chambers.get(cell_id)])
      ),
      mistakes: mistakes,
    };
    return x;
  }
}
