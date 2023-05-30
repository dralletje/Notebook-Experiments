import * as Graph from "./leaf/graph.js";
import type { Opaque } from "ts-opaque";
import { Engine } from "./parts/engine.js";
import { CellId } from "./blueprint/blueprint.js";

export type VariableName = Opaque<string, "VariableName"> & Graph.EdgeName;

export type Cell = {
  code: string;
  type: "code" | "text";
  folded: boolean;
  requested_run_time: number;
  id: CellId;
};
export type Notebook = Readonly<{
  cells: Readonly<{ [key: CellId]: Cell }>;
  cell_order: CellId[];
}>;

export type Workspace = {
  files: { [filename: string]: { filename: string; notebook: Notebook } };
};
export type WorkspaceEngine = {
  files: { [filename: string]: Engine };
};
