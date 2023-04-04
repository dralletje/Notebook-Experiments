import pc from "picocolors";
import Opaque from "ts-opaque";
import { Notebook, VariableName } from "../types";
import {
  ExecutionResult,
  find_chamber_to_run_now,
  find_pending_cells,
} from "./notebook-step.js";
import { TypedEventTarget } from "../leaf/typed-event-target.js";
import { ModernMap } from "@dral/modern-map";
import { Blueprint, CellId } from "../blueprint/blueprint";
import { StacklessError } from "../javascript-notebook-runner";
import { groupCollapsed, groupSilent } from "../leaf/group";

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
   * so I can find out about them even if they are deleted or
   * no longer connected in the next run.
   */
  upstream_cells: Array<CellId> = [];
  /**
   * TODO Need to figure out why exactly I need this
   */
  last_internal_run: EngineTime = EngineTime.EARLIEST;

  private abort_controller: AbortController | null = null;
  reset() {
    if (this.abort_controller == null) return false;

    // If there was a previous run, allow performing cleanup.
    this.abort_controller?.abort();
    this.abort_controller = null;
    return true;
  }
  run() {
    this.abort_controller = new AbortController();
    this.running = true;
    this.waiting = false;
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
    let start = performance.now();
    let i = 0;
    while (await this.update_once(this.pending_blueprint)) {
      i++;
    }
    let end = performance.now();
    console.log(pc.green(`Engine update took ${Math.round(end - start)}ms`));
    console.log(pc.green(`${i} @ ${Math.round((end - start) / i)}ms`));
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
    for (let [cell_id, cell] of blueprint.mistakes) {
      this.cylinders.emplace(cell_id as CellId, {
        insert: (cell_id) => new Cylinder(cell_id),
      });
    }

    /////////////////////////////////////
    // Get next cell to run
    /////////////////////////////////////

    let { pending_chambers, pending_mistakes } = groupSilent(
      "Pending chambers and mistakes",
      () => find_pending_cells(blueprint, this)
    );

    let did_update_pending = false;
    if (pending_chambers.size > 0 || pending_mistakes.size > 0) {
      for (let chamber of pending_chambers.values()) {
        let cylinder = this.cylinders.get(chamber.id);
        if (!cylinder.waiting) {
          cylinder.waiting = true;
          did_update_pending = true;
        }
      }

      for (let mistake of pending_mistakes.values()) {
        let cylinder = this.cylinders.get(mistake.id);
        Object.assign(cylinder, {
          last_run: mistake.requested_run_time,
          last_internal_run: this.tick(),
          result: { type: "throw", value: new StacklessError(mistake.message) },
          running: false,
          waiting: false,
          upstream_cells: mistake.node.in.map(([id]) => id) as CellId[],
          variables: {},
        });
        did_update_pending = true;
      }
    }
    if (did_update_pending) {
      this.dispatchEvent(new EngineChangeEvent());
    }

    /////////////////////////////////////
    // Delete overdue cylinders
    /////////////////////////////////////
    // "Just" run all handlers for deleted cells
    // TODO? I just know this will bite me later
    // TODO Wrap abort controller handles so I can show when they go wrong
    let deleted_cylinders = this.cylinders
      .values()
      .filter(
        (cylinder) =>
          !blueprint.chambers.has(cylinder.id) &&
          !blueprint.mistakes.has(cylinder.id)
      );
    let needs_tick = false;
    for (let deleted_cylinder of deleted_cylinders) {
      if (deleted_cylinder.reset()) {
        needs_tick = true;
      }
      this.cylinders.delete(deleted_cylinder.id);
    }

    for (let pending_chamber of pending_chambers.values()) {
      let cylinder = this.cylinders.get(pending_chamber.id);
      if (cylinder.reset()) {
        needs_tick = true;
      }
    }

    // Wait a tick for the abort to actually happen (possibly)
    // if (needs_tick) {
    //   await new Promise((resolve) => setTimeout(resolve, 0));
    // }

    /////////////////////////////////////
    // Run it!
    /////////////////////////////////////
    let chamber_to_run = groupSilent("Find chamber to run now", () =>
      find_chamber_to_run_now({
        engine: this,
        pending_chambers,
      })
    );
    // let chamber_to_run = [...pending_chambers][0]?.[1];

    if (chamber_to_run) {
      did_change = true;
      let event_id = this.tick();
      let cylinder = this.cylinders.get(chamber_to_run.id);

      cylinder.run();
      this.dispatchEvent(new EngineChangeEvent());
      this.dispatchEvent(
        new EngineLogEvent({
          id: event_id,
          cell_id: chamber_to_run.id,
          code: chamber_to_run.code,
        })
      );

      // prettier-ignore
      let inputs  = groupSilent(pc.blue(pc.bold(`RUNNING CELL`)), pc.blue(chamber_to_run.id), () => {
        // console.log(pc.blue(chamber_to_run.code));
        // Look for requested variable names in other cylinders
        let inputs = {};
        for (let [in_cell, edge] of chamber_to_run.node.in) {
          let in_cylinder = this.cylinders.get(in_cell as CellId);
          if (edge.out in in_cylinder.variables) {
            inputs[edge.in] = in_cylinder.variables[edge.out];
          }
        }
        // console.log(`inputs:`, inputs)
        return inputs
      })

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
        variables:
          result.type === "return"
            ? // TODO Hack to get sheets working
              { ...result.value, [chamber_to_run.id]: result.value.default }
            : {},
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
