import { Serialized } from "./parts/serialize";

export type DAGElement = {
  id: CellId;
  in: DAGElement[];
  out: DAGElement[];
};

type ResultState<T, E> =
  | { type: "return"; name?: string; value: T }
  | { type: "throw"; value: E }
  | { type: "pending" };

export type CellId = string;

export type Engine = {
  cylinders: { [cell_id: CellId]: Cylinder };
  internal_run_counter: number;
  dag: { [key: CellId]: DAGElement };
  is_busy: boolean;
};

type LivingValue = any;

export type Cylinder = {
  id: CellId;
  name: string;
  last_run: number;
  last_internal_run: number;
  running: boolean;
  waiting: boolean;
  result: ResultState<Serialized, Serialized>;
  variables: { [name: string]: LivingValue };
  upstream_cells: Array<CellId>;
  abort_controller: AbortController;
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
