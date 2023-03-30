import Opaque from "ts-opaque";
import { CellId, Notebook, VariableName } from "../types";
import { ParsedCell } from "./parse-cell";
import { RunCellFunction, notebook_step } from "./notebook-step";

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

class TypedEventTarget<
  EventMap extends Record<string, any>
> extends EventTarget {
  addEventListener<K extends keyof EventMap, T extends this>(
    type: K,
    listener: (ev: EventMap[K] & { target: T }) => any,
    options?: any
  ): void {
    super.addEventListener(type as string, listener, options);
  }
  dispatchEvent<K extends keyof EventMap>(event: EventMap[K]): boolean {
    return super.dispatchEvent(event);
  }
}

export class EngineChangeEvent extends Event {
  currentTarget: Engine;
  constructor() {
    super("change");
  }
}

export class EngineLogEvent extends Event {
  log: any;
  constructor(log) {
    super("log");
    this.log = log;
  }
}

export class Engine extends TypedEventTarget<{
  change: EngineChangeEvent;
  log: EngineLogEvent;
}> {
  private pending_notebook: Notebook = { cell_order: [], cells: {} };
  private is_busy: boolean = false;

  parse_cache: Map<CellId, ParsedCell>;
  cylinders: Map<CellId, Cylinder>;
  internal_run_counter: EngineRunCountTracker;
  // graph: Graph.Graph;

  readonly run_cell: RunCellFunction;

  constructor(run_cell: RunCellFunction) {
    super();

    this.run_cell = run_cell;

    this.is_busy = false;
    this.parse_cache = new Map();
    this.cylinders = new Map();
    this.internal_run_counter = 0 as EngineRunCountTracker;
  }

  async update(notebook: Notebook) {
    this.pending_notebook = notebook;

    if (this.is_busy) return;
    this.is_busy = true;

    let did_change = true;
    while (did_change === true) {
      did_change = false;

      await notebook_step({
        engine: this,
        filename: "app.tsx",
        notebook: this.pending_notebook,
        run_cell: this.run_cell,
        onChange: (fn) => {
          did_change = true;
          fn(this);
          this.dispatchEvent(new EngineChangeEvent());
        },
        onLog: (log) => {
          this.dispatchEvent(new EngineLogEvent(log));
        },
      });
      this.dispatchEvent(new EngineChangeEvent());
    }
    this.is_busy = false;
  }
}
