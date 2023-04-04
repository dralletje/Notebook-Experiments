import { invariant } from "../leaf/invariant.js";
import { Engine, EngineTime } from "./engine.js";
import { DeepReadonly } from "../leaf/DeepReadonly.js";
import { Blueprint, CellId, Chamber, Mistake } from "../blueprint/blueprint.js";
import { StacklessError } from "../javascript-notebook-runner.js";
import { ModernMap } from "@dral/modern-map";

export let find_pending_cells = (
  blueprint: Blueprint,
  engine: DeepReadonly<Engine>
) => {
  let cell_should_run_at_map = new Map<CellId, EngineTime>();
  let cells_that_should_run: CellId[] = [];

  for (let [cell_id, chamber] of [
    // TODO Dirtiest hack yet, but to pick up changes in mistakes (who possibly no ordered topologicaly),
    // .... I need to run them twice, so they can be picked up in the second run.
    ...blueprint.mistakes,
    ...blueprint.chambers,
    ...blueprint.mistakes,
  ]) {
    let cylinder = engine.cylinders.get(cell_id);
    // console.log(`cylinder:`, cylinder);
    // console.log(`chamber:`, chamber);

    // prettier-ignore
    invariant(chamber.requested_run_time != null, `cell.requested_run_time shouldn't be null`);
    // prettier-ignore
    invariant(cylinder?.last_run != null, `cylinder.last_run shouldn't be null`);

    // Cell has been requested to run explicitly, so just run it!
    if (chamber.requested_run_time > cylinder.last_run) {
      cell_should_run_at_map.set(cell_id, EngineTime.LATEST);
      cells_that_should_run.push(cell_id);
      continue;
    }

    // Here comes the tricky part: I need to "carry over" the `should_run` times from the parent cells.
    let should_run_at = EngineTime.latest(
      cylinder.last_internal_run,

      ...chamber.node.in.map(([upstream_id]) => {
        if (!cell_should_run_at_map.has(upstream_id as CellId)) {
          // Due to how sorting works, if the cell is part of a cyclic chain,
          // we process some of them before we processed their cyclic siblings.
          // There is a check for this later, so we don't have to worry here.
          return EngineTime.EARLIEST;
        } else {
          return cell_should_run_at_map.get(upstream_id as CellId);
        }
      }),

      // This is so that when you have
      // CELL_1: a = 10
      // CELL_2: b = a
      // You run them, all fine, but now! You remove CELL_1 (or change it so it doesn't define `a`).
      // How would CELL_2 know to run again? It's not connected the DAG anymore!
      // So I have to remember the cells CELL_2 depended on in the last run,
      // and check if any of those have changed.
      ...cylinder.upstream_cells.map((upstream_id) => {
        if (!engine.cylinders.get(upstream_id)) {
          // Cell was deleted
          return EngineTime.LATEST;
        } else if (
          !cell_should_run_at_map.has(upstream_id) &&
          !chamber.node.in.some(([x]) => x === upstream_id)
        ) {
          // Cell _was_ part of a cyclic chain AND the sibling cell we're looking at isn't part of our cycle
          // anymore, which means it was changed! So we need to run!!
          return EngineTime.LATEST;
        } else {
          // Cell might have executed later, and removed our variable
          return cell_should_run_at_map.get(upstream_id);
        }
      })
    );

    cell_should_run_at_map.set(cell_id, should_run_at);

    if (should_run_at > cylinder.last_internal_run) {
      cells_that_should_run.push(cell_id);
    }
  }

  let pending_chambers = new ModernMap<CellId, Chamber>();
  let pending_mistakes = new ModernMap<CellId, Mistake>();
  for (let cell_id of cells_that_should_run) {
    if (blueprint.chambers.has(cell_id)) {
      pending_chambers.set(cell_id, blueprint.chambers.get(cell_id));
    } else if (blueprint.mistakes.has(cell_id)) {
      pending_mistakes.set(cell_id, blueprint.mistakes.get(cell_id));
    } else {
      throw new Error("AAAAA");
    }
  }
  return { pending_chambers, pending_mistakes };
};

// TODO Not used in this file
export type ExecutionResult<T = any, E = any> =
  | { type: "return"; value: T }
  | { type: "throw"; value: E };

export let find_chamber_to_run_now = ({
  engine,
  pending_chambers,
}: {
  engine: DeepReadonly<Engine>;
  pending_chambers: ModernMap<CellId, Chamber>;
}) => {
  /////////////////////////////////////
  // Find next cell to run
  /////////////////////////////////////

  // If there is no cell that needs running, we're done!
  if (pending_chambers.size === 0) return null;

  // By default just run the first (topologically sorted)
  let chamber_to_run = pending_chambers.values().toArray()[0];

  // Additionally, find all cells that can run now (have no pending upstream cells)
  // and find the one that was requested to run the shortest time ago
  let cells_that_can_run = pending_chambers.values().filter((chamber) => {
    return pending_chambers.values().every((possibly_upstream) => {
      return !chamber.node.in.some(([id]) => id === possibly_upstream.id);
    });
  });
  for (let chamber of cells_that_can_run) {
    if (
      // Has the cell been requested to run, or is it running because of upstream
      chamber.requested_run_time !==
        engine.cylinders.get(chamber.id).last_run &&
      // Is the cell requested to run earlier than the current cell to run
      chamber.requested_run_time > chamber_to_run.requested_run_time
    ) {
      chamber_to_run = chamber;
    }
  }

  return chamber_to_run;
};
