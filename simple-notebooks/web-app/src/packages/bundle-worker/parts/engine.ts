import pc from "picocolors";
import { omit } from "lodash-es";
import Opaque from "ts-opaque";
import { CellId, Notebook, VariableName } from "../types";
import { ParsedCell } from "./parse-cell";
import {
  ExecutionResult,
  notebook_step,
  parse_all_cells,
} from "./notebook-step";
import { TypedEventTarget } from "../leaf/typed-event-target";
import { invariant } from "../leaf/invariant";
import { ModernMap } from "../leaf/ModernMap";

export type LivingValue = Opaque<unknown, "LivingValue">;
export type EngineRunCountTracker = Opaque<number, "RunTracker">;

type ResultState<ReturnValue, ThrowValue> =
  | { type: "return"; name?: string; value: ReturnValue }
  | { type: "throw"; value: ThrowValue };

export class Cylinder {
  id: CellId;
  constructor(cell_id: CellId) {
    this.id = cell_id;
  }

  running: boolean = false;
  waiting: boolean = false;
  result: ResultState<LivingValue, any> = { type: "return", value: undefined };

  // These are only used internally by the engine
  // TODO Put them in a separate object?
  last_run: number = -Infinity;
  variables: { [name: VariableName]: LivingValue } = {};
  /**
   * Why do I need this, if it is already in the graph?
   * I need to know what cells the last run of this cell depended on
   * so I can find out about them even if they are deleted.
   */
  upstream_cells: Array<CellId> = [];
  abort_controller: AbortController = new AbortController();
  /**
   * TODO Need to figure out why exactly I need this
   */
  last_internal_run: EngineRunCountTracker = -Infinity as EngineRunCountTracker;
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

export type RunCellFunction = (options: {
  signal: AbortSignal;
  code: string;
  inputs: { [key: string]: any };
}) => Promise<{
  result: ExecutionResult<{
    [name: VariableName]: LivingValue;
    default: LivingValue;
  }>;
}>;

export class Engine extends TypedEventTarget<{
  change: EngineChangeEvent;
  log: EngineLogEvent;
}> {
  private pending_notebook: Notebook = { cell_order: [], cells: {} };
  private is_busy: boolean = false;

  parse_cache: ModernMap<CellId, ParsedCell>;
  cylinders: ModernMap<CellId, Cylinder>;
  internal_run_counter: EngineRunCountTracker;
  // graph: Graph.Graph;

  readonly run_cell: RunCellFunction;

  constructor(run_cell: RunCellFunction) {
    super();

    this.run_cell = run_cell;

    this.is_busy = false;
    this.parse_cache = new ModernMap();
    this.cylinders = new ModernMap();
    this.internal_run_counter = 0 as EngineRunCountTracker;
  }

  async update(notebook: Notebook) {
    this.pending_notebook = notebook;

    if (this.is_busy) return;
    this.is_busy = true;

    let did_change = true;
    while (did_change === true) {
      did_change = false;

      // Make sure every cell has a cylinder
      for (let [cell_id, cell] of Object.entries(this.pending_notebook.cells)) {
        if (!this.cylinders.has(cell_id as CellId)) {
          this.cylinders.set(
            cell_id as CellId,
            new Cylinder(cell_id as CellId)
          );
        }
      }

      // "Just" run all handlers for deleted cells
      // TODO? I just know this will bite me later
      // TODO Wrap abort controller handles so I can show when they go wrong
      let deleted_cells = this.cylinders.values().filter((cylinder) => {
        return cylinder.id in notebook.cells === false;
      });
      for (let deleted_cell of deleted_cells) {
        deleted_cell.abort_controller.abort();
        this.cylinders.delete(deleted_cell.id);
      }

      /////////////////////////////////////
      // Get next cell to run
      /////////////////////////////////////

      let cell_to_run = await notebook_step({
        engine: this,
        filename: "app.tsx",
        notebook: this.pending_notebook,
        onChange: (fn) => {
          did_change = true;
          fn(this);
          this.dispatchEvent(new EngineChangeEvent());
        },
        onLog: (log) => {
          this.dispatchEvent(new EngineLogEvent(log));
        },
      });

      if (cell_to_run) {
        did_change = true;

        /////////////////////////////////////
        // Run it!
        /////////////////////////////////////

        this.dispatchEvent(
          new EngineLogEvent({
            title: "Running cell",
            cellId: cell_to_run,
            body: "Whoiiii",
          })
        );

        let parsed_cells = parse_all_cells(this, this.pending_notebook);

        let key = cell_to_run.cell_id;
        let cell = notebook.cells[key];
        let parsed = parsed_cells[cell.id];
        let cylinder = this.cylinders.get(key);
        let graph_node = cell_to_run.graph_node;
        invariant("output" in parsed, `Parsed error shouldn't end up here`);

        cylinder.running = true;
        cylinder.waiting = false;
        this.dispatchEvent(new EngineChangeEvent());

        let {
          code,
          meta: { last_created_name },
        } = parsed.output;

        console.log(pc.blue(pc.bold(`RUNNING CODE:`)));
        console.log(pc.blue(code));

        // Look for requested variable names in other cylinders
        let inputs = Object.fromEntries(
          graph_node.in.entries().map(([in_cell, { name: in_name }]) => {
            let in_cylinder = this.cylinders.get(in_cell as CellId);
            return [in_name, in_cylinder.variables[in_name]];
          })
        );

        // If there was a previous run, allow performing cleanup.
        cylinder.abort_controller?.abort();
        // Wait a tick for the abort to actually happen (possibly)
        await new Promise((resolve) => setTimeout(resolve, 0));

        let abort_controller = new AbortController();
        cylinder.abort_controller = abort_controller;

        let { result } = await this.run_cell({
          signal: abort_controller.signal,
          code: code,
          inputs: inputs,
        });

        Object.assign(this.cylinders.get(key), {
          last_run: cell.requested_run_time,
          // @ts-ignore
          last_internal_run: this
            .internal_run_counter++ as EngineRunCountTracker,
          upstream_cells: graph_node.in.keys().toArray() as CellId[],

          result:
            result.type === "return"
              ? {
                  type: "return",
                  name: last_created_name,
                  value: result.value.default,
                }
              : result,
          running: false,
          variables:
            result.type === "return" ? omit(result.value, "default") : {},
        });
      }
      this.dispatchEvent(new EngineChangeEvent());
    }
    this.is_busy = false;
  }
}
