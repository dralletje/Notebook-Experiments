import { ModernMap } from "@dral/modern-map";
import { CellId } from "../types.js";

import * as Graph from "../leaf/graph.js";

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
  // graph: Graph.Graph;
  // arrangment: Array<CellId>;
  chambers: ModernMap<CellId, Chamber>;
  mistakes: ModernMap<CellId, Mistake>;
};
