import * as Graph from "./leaf/graph";
import type { Opaque } from "ts-opaque";
import { Engine } from "./parts/engine";

export type CellId = Opaque<string, "CellId"> & Graph.NodeId;
export type VariableName = Opaque<string, "VariableName"> & Graph.EdgeName;

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
