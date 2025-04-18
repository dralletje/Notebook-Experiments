import type { Opaque } from "ts-opaque";
import { ModernMap } from "@dral/modern-map";

import * as Graph from "../leaf/graph.js";

export type CellId = Opaque<string, "CellId"> & Graph.NodeId;

export type VariableName = Opaque<string, "VariableName"> & Graph.EdgeName;

export interface Chamber {
  id: CellId;
  requested_run_time: number;
  name: string;
  code: string;
  node: Graph.Node;
}

export interface Mistake {
  id: CellId;
  requested_run_time: number;
  message: string;
  node: Graph.Node;
}

export type Blueprint = {
  chambers: ModernMap<CellId, Chamber>;
  mistakes: ModernMap<CellId, Mistake>;
};
