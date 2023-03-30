import * as Graph from "./leaf/graph";
import { ParsedCell } from "./leaf/parse-cell";

type ResultState<ReturnValue, ThrowValue> =
  | { type: "return"; name?: string; value: ReturnValue }
  | { type: "throw"; value: ThrowValue };

export type CellId = string & Graph.NodeId;

export type Engine = {
  cylinders: { [cell_id: CellId]: Cylinder };
  internal_run_counter: number;
  graph: Graph.Graph;
  is_busy: boolean;
  parse_cache: Map<CellId, ParsedCell>;
};

type LivingValue = any;

export type Cylinder = {
  id: CellId;

  running: boolean;
  waiting: boolean;
  result: ResultState<{ name?: string | null }, any>;

  // These are only used internally by the engine
  // TODO Put them in a separate object?
  last_run: number;
  variables: { [name: string]: LivingValue };
  /**
   * Why do I need this, if it is already in the graph?
   * I need to know what cells the last run of this cell depended on
   * so I can find out about them even if they are deleted
   */
  upstream_cells: Array<CellId>;
  abort_controller: AbortController;
  /**
   * TODO Need to figure out why exactly I need this
   */
  last_internal_run: number;
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
  requested_run_time: number;
  id: CellId;
};
