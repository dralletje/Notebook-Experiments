import { compact, mapValues, sortBy, uniq } from "lodash-es";

/**
 * @param {import("./node-engine").Notebook} notebook
 * @param {import("./node-engine").Engine} engine
 * @returns {{ [key: import("./node-engine").CellId]: import("./node-engine").DAGElement }}
 */
export let cells_to_dag = (notebook, engine) => {
  let surface_level_dag = {
    ...mapValues(notebook.cells, (cell, id) => {
      return /** @type {import("./node-engine").DAGElement} */ ({
        id: id,
        in: [],
        out: [],
      });
    }),
    ...mapValues(engine.cylinders, (cylinder, id) => {
      return /** @type {import("./node-engine").DAGElement} */ ({
        id: id,
        in: [],
        out: [],
      });
    }),
  };

  let source_of_knowledge = mapValues(notebook.cells, (cell, id) => {
    let cylinder = engine.cylinders[id];
    let parsed_output = cylinder.__transformed_code_cache__.output ?? {
      consumed_names: [],
      created_names: [],
    };
    return {
      id: id,
      in_vars: parsed_output.consumed_names,
      out_vars: parsed_output.created_names,
      in_ids: cylinder.upstream_cells ?? [],
    };
  });

  for (let dag_entry of Object.values(surface_level_dag)) {
    let source_entry = source_of_knowledge[dag_entry.id];
    if (source_entry == null) {
      continue;
    }
    dag_entry.in = uniq([
      ...source_entry.in_ids.map((id) => surface_level_dag[id]),
      ...compact(
        source_entry.in_vars.map((v) => {
          let id = Object.values(source_of_knowledge).find((x) =>
            x.out_vars.includes(v)
          )?.id;
          if (id) {
            return surface_level_dag[id];
          }
        })
      ),
    ]);
    dag_entry.out = uniq([
      ...Object.values(source_of_knowledge)
        .filter((source) => source.in_ids.includes(dag_entry.id))
        .map((source) => surface_level_dag[source.id]),
      ...compact(
        source_entry.out_vars.map((v) => {
          let id = Object.values(source_of_knowledge).find((x) =>
            x.in_vars.includes(v)
          )?.id;
          if (id) {
            return surface_level_dag[id];
          }
        })
      ),
    ]);
  }
  return surface_level_dag;
};

/**
 * @param {import("./node-engine").DAGElement} start_dag
 * @param {import("./node-engine").Engine} engine
 * @param {import("./node-engine").Notebook} notebook
 */
export let find_cell_that_needs_running = (start_dag, engine, notebook) => {
  for (let upstream_element of compact(start_dag.in)) {
    let upstream_upstream = find_cell_that_needs_running(
      upstream_element,
      engine,
      notebook
    );
    if (upstream_upstream) {
      return upstream_upstream.id;
    }
  }

  if (
    (engine.cylinders[start_dag.id]?.last_run ?? -Infinity) <
    (notebook.cells[start_dag.id].last_run ?? -Infinity)
  ) {
    return start_dag.id;
  }
};

/**
 * @param {import("./node-engine").DAGElement} start_dag
 * @param {import("./node-engine").Engine} engine
 * @param {import("./node-engine").Notebook} notebook
 * @returns {string | void}
 */
export let find_downstream_cells_that_are_delayed = (
  start_dag,
  engine,
  notebook
) => {
  // This can be pretty ineffecient as there will be upstream cells that will re-trigger downstream cells
  // that we have already re-ran...

  for (let downstream_element of start_dag.out) {
    // If the downstream element has run BEFORE the start element, it is delayed...
    // and we need to run it again!
    // Not to worry about the downstream of this cell, those will come eventually...
    if (
      (engine.cylinders[downstream_element.id]?.last_internal_run ??
        -Infinity) <
      (engine.cylinders[start_dag.id].last_internal_run ?? -Infinity)
    ) {
      return downstream_element.id;
    }

    let downstream_downstream = find_downstream_cells_that_are_delayed(
      downstream_element,
      engine,
      notebook
    );
    if (downstream_downstream) {
      return downstream_downstream;
    }
  }
};

/**
 * @param {import("./node-engine").DAGElement} start_dag
 * @param {import("./node-engine").Engine} engine
 * @param {import("./node-engine").Notebook} notebook
 * @returns {string | void}
 */
export let find_upstream_cells_that_are_removed = (
  start_dag,
  engine,
  notebook
) => {
  // This can be pretty ineffecient as there will be upstream cells that will re-trigger downstream cells
  // that we have already re-ran...
  for (let upstream_element of start_dag.in) {
    if (upstream_element == null) {
      return start_dag.id;
    }

    let downstream_downstream = find_upstream_cells_that_are_removed(
      upstream_element,
      engine,
      notebook
    );
    if (downstream_downstream) {
      return downstream_downstream;
    }
  }
};

/**
 * @param {import("./node-engine").Engine} engine
 * @param {import("./node-engine").Notebook} notebook
 * @returns {[import("./node-engine").CellId, import("./node-engine").Cell] | void}
 */
export let get_next_cell_to_run = (engine, notebook) => {
  let dag = cells_to_dag(notebook, engine);

  // Figure out which cell to run
  let cells_that_need_running = Object.entries(notebook.cells).filter(
    ([key, cell]) => {
      return (
        (cell.last_run ?? -Infinity) >
        (engine.cylinders[key]?.last_run ?? -Infinity)
      );
    }
  );

  if (cells_that_need_running.length > 0) {
    // There is a cell that has explicitly been asked to run, so lets see if
    // we can get that one as soon as possible.

    let most_intensely_requested_cell_entry = sortBy(
      cells_that_need_running,
      ([key, cell]) => cell.last_run
    )[0];

    let [id, cell] = most_intensely_requested_cell_entry;
    let cylinder = engine.cylinders[id] ?? {};

    // We got the cell that we want to run most desperately,
    // but lets first see if any cells in its graph need to be run first.
    // let upstream_cells = find_upstream_cells(cell, engine, notebook);
    // console.log(`upstream_cells:`, upstream_cells);

    let dag = cells_to_dag(notebook, engine);

    let start_dag = dag[id];

    let upstream = find_cell_that_needs_running(start_dag, engine, notebook);
    return [id, cell];
  }

  // Not any explicit request, BUT,
  // we could still have upstream cells that have been removed,
  // in case we also need to re-run
  for (let element of Object.values(dag)) {
    if (element.out.length === 0) {
      let has_an_upstream_removed = find_upstream_cells_that_are_removed(
        element,
        engine,
        notebook
      );
      if (has_an_upstream_removed) {
        return [
          has_an_upstream_removed,
          notebook.cells[has_an_upstream_removed],
        ];
      }
    }
  }

  // Not any explicit request, BUT, we could still have downstream cells that have not been
  // executed in response yet...
  // So lets explore that way...
  for (let element of Object.values(dag)) {
    if (element.in.length === 0) {
      let downstream_delayed = find_downstream_cells_that_are_delayed(
        element,
        engine,
        notebook
      );
      if (downstream_delayed) {
        return [downstream_delayed, notebook.cells[downstream_delayed]];
      }
    }
  }
};
