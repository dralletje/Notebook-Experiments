import pc from "picocolors";
import Opaque from "ts-opaque";
import { CellId, Notebook, VariableName } from "../types";
import { ExecutionResult, find_cell_to_run_now } from "./notebook-step.js";
import { TypedEventTarget } from "../leaf/typed-event-target.js";
import { ModernMap } from "@dral/modern-map";
import { Blueprint } from "../blueprint/blueprint";

export type LivingValue = Opaque<unknown, "LivingValue">;
export type EngineTime = Opaque<number, "RunTracker">;
export let EngineTime = {
  LATEST: Infinity as EngineTime,
  EARLIEST: 0 as EngineTime,
  latest: Math.max as (...args: EngineTime[]) => EngineTime,
};

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
  /**
   * TODO Need to figure out why exactly I need this
   */
  last_internal_run: EngineTime = EngineTime.EARLIEST;

  private abort_controller: AbortController = new AbortController();
  async reset() {
    // If there was a previous run, allow performing cleanup.
    this.abort_controller?.abort();
    // Wait a tick for the abort to actually happen (possibly)
    await new Promise((resolve) => setTimeout(resolve, 0));

    let abort_controller = new AbortController();
    this.abort_controller = abort_controller;
  }
  get signal() {
    return this.abort_controller.signal;
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
  constructor(log: { id: unknown; cell_id: CellId; code: string }) {
    super("log");
    this.log = log;
  }
}

export type RunCellFunction = (options: {
  id: CellId;
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
  private pending_blueprint: Blueprint = {
    chambers: new ModernMap(),
    mistakes: new ModernMap(),
  };
  private is_busy: boolean = false;

  cylinders: ModernMap<CellId, Cylinder> = new ModernMap();
  // graph: Graph.Graph;

  private internal_run_counter: EngineTime = EngineTime.EARLIEST;
  tick() {
    return this.internal_run_counter++;
  }

  readonly run_cell: RunCellFunction;

  constructor(run_cell: RunCellFunction) {
    super();
    this.run_cell = run_cell;
  }

  async update(blueprint: Blueprint) {
    this.pending_blueprint = blueprint;

    if (this.is_busy) return;

    this.is_busy = true;
    while (await this.update_once(this.pending_blueprint)) {}
    this.is_busy = false;
  }

  private async update_once(blueprint: Blueprint): Promise<boolean> {
    let did_change = false;

    // Make sure every cell has a cylinder
    for (let [cell_id, cell] of blueprint.chambers) {
      this.cylinders.emplace(cell_id as CellId, {
        insert: (cell_id) => new Cylinder(cell_id),
      });
    }

    /////////////////////////////////////
    // Get next cell to run
    /////////////////////////////////////

    console.log(`blueprint:`, blueprint);

    let chamber_to_run = find_cell_to_run_now({
      engine: this,
      blueprint: blueprint,
      onChange: (fn) => {
        did_change = true;
        fn(this);
        this.dispatchEvent(new EngineChangeEvent());
      },
    });

    console.log(`chamber_to_run:`, chamber_to_run);

    /////////////////////////////////////
    // Delete overdue cylinders
    /////////////////////////////////////
    // "Just" run all handlers for deleted cells
    // TODO? I just know this will bite me later
    // TODO Wrap abort controller handles so I can show when they go wrong
    let deleted_cylinders = this.cylinders
      .values()
      .filter((cylinder) => !blueprint.chambers.has(cylinder.id));
    for (let deleted_cylinder of deleted_cylinders) {
      await deleted_cylinder.reset();
      this.cylinders.delete(deleted_cylinder.id);
    }

    let event_id = this.tick();

    /////////////////////////////////////
    // Run it!
    /////////////////////////////////////
    if (chamber_to_run) {
      did_change = true;

      let cylinder = this.cylinders.get(chamber_to_run.id);

      cylinder.running = true;
      cylinder.waiting = false;
      this.dispatchEvent(new EngineChangeEvent());
      this.dispatchEvent(
        new EngineLogEvent({
          id: event_id,
          cell_id: chamber_to_run.id,
          code: chamber_to_run.code,
        })
      );

      console.groupCollapsed(
        pc.blue(pc.bold(`RUNNING CELL: ${chamber_to_run.id}`))
      );
      console.log(pc.blue(chamber_to_run.code));
      console.groupEnd();

      // Look for requested variable names in other cylinders
      let inputs = {};
      for (let [in_cell, { name: in_name }] of chamber_to_run.node.in) {
        let in_cylinder = this.cylinders.get(in_cell as CellId);
        if (in_name in in_cylinder.variables) {
          inputs[in_name] = in_cylinder.variables[in_name];
        }
      }

      await cylinder.reset();

      let { result } = await this.run_cell({
        id: chamber_to_run.id,
        signal: cylinder.signal,
        code: chamber_to_run.code,
        inputs: inputs,
      });

      Object.assign(cylinder, {
        last_run: chamber_to_run.requested_run_time,
        last_internal_run: this.tick(),
        upstream_cells: chamber_to_run.node.in.map(([x]) => x) as CellId[],

        result:
          result.type === "return"
            ? {
                type: "return",
                name: chamber_to_run.name,
                value: result.value.default,
              }
            : result,
        running: false,
        variables: result.type === "return" ? result.value : {},
      });

      this.dispatchEvent(new EngineChangeEvent());
      this.dispatchEvent(
        new EngineLogEvent({
          id: event_id,
          cell_id: chamber_to_run.id,
          code: chamber_to_run.code,
        })
      );
    }

    return did_change;
  }
}
