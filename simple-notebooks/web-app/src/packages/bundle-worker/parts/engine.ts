import Opaque from "ts-opaque";
import { CellId, VariableName } from "../types";
import { ParsedCell } from "./parse-cell";

export type LivingValue = Opaque<any, "LivingValue">;
export type EngineRunCountTracker = Opaque<number, "RunTracker">;

type ResultState<ReturnValue, ThrowValue> =
  | { type: "return"; name?: string; value: ReturnValue }
  | { type: "throw"; value: ThrowValue };

export type Cylinder = {
  id: CellId;

  running: boolean;
  waiting: boolean;
  result: ResultState<{ name?: string | null }, any>;

  // These are only used internally by the engine
  // TODO Put them in a separate object?
  last_run: number;
  variables: { [name: VariableName]: LivingValue };
  /**
   * Why do I need this, if it is already in the graph?
   * I need to know what cells the last run of this cell depended on
   * so I can find out about them even if they are deleted.
   */
  upstream_cells: Array<CellId>;
  abort_controller: AbortController;
  /**
   * TODO Need to figure out why exactly I need this
   */
  last_internal_run: EngineRunCountTracker;
};

export class Engine {
  is_busy: boolean;
  parse_cache: Map<CellId, ParsedCell>;

  cylinders: Map<CellId, Cylinder>;
  internal_run_counter: EngineRunCountTracker;
  // graph: Graph.Graph;

  constructor() {
    this.is_busy = false;
    this.parse_cache = new Map();
    this.cylinders = new Map();
    this.internal_run_counter = 0 as EngineRunCountTracker;
  }
}
