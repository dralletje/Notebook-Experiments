import { compact, mapValues, sortBy, uniq } from "lodash-es";

type BasicDAG = { [key: string]: string[] };

type ExpandedDAGElement = { id: string; in: string[]; out: string[] };
type ExpandedDAG = { [key: string]: ExpandedDAGElement };

type RecursiveDAG = { in: RecursiveDAG[]; out: RecursiveDAG[] };

export let expand_dag = (dag: BasicDAG): ExpandedDAG => {
  let expanded_dag: ExpandedDAG = mapValues(dag, (out, id) => ({
    id,
    out,
    in: [],
  })) as any;
  for (let id in expanded_dag) {
    for (let out of expanded_dag[id].out) {
      expanded_dag[out].in.push(id);
    }
  }
  return expanded_dag;
};

export let recursive_dag = (
  dag: ExpandedDAG
): { [key: string]: RecursiveDAG } => {
  let recursive_dag: { [key: string]: RecursiveDAG } = {};
  // Fill with empty objects so we can store the reference
  for (let id in dag) {
    recursive_dag[id] = {
      in: [],
      out: [],
    };
  }
  // Fill every element with the actual data
  for (let id in dag) {
    recursive_dag[id] = {
      in: dag[id].in.map((in_id) => recursive_dag[in_id]),
      out: dag[id].out.map((out_id) => recursive_dag[out_id]),
    };
  }
  return recursive_dag;
};

export let topological_sort = (dag: ExpandedDAG): string[] => {
  let sorted: string[] = [];
  let visited: string[] = [];
  let visit = (id: string) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let out of dag[id].in) {
      visit(out);
    }
    sorted.push(id);
  };
  for (let id in dag) {
    visit(id);
  }
  return sorted;
};

// /**
//  * @param {import("./node-engine").DAGElement} start_dag
//  * @param {import("./node-engine").Engine} engine
//  * @param {import("./node-engine").Notebook} notebook
//  */
// export let find_cell_that_needs_running = (start_dag, engine, notebook) => {
//   for (let upstream_element of compact(start_dag.in)) {
//     let upstream_upstream = find_cell_that_needs_running(
//       upstream_element,
//       engine,
//       notebook
//     );
//     if (upstream_upstream) {
//       return upstream_upstream.id;
//     }
//   }

//   if (
//     (engine.cylinders[start_dag.id]?.last_run ?? -Infinity) <
//     (notebook.cells[start_dag.id].last_run ?? -Infinity)
//   ) {
//     return start_dag.id;
//   }
// };

// /**
//  * @param {import("./node-engine").DAGElement} start_dag
//  * @param {import("./node-engine").Engine} engine
//  * @param {import("./node-engine").Notebook} notebook
//  * @returns {string | void}
//  */
// export let find_downstream_cells_that_are_delayed = (
//   start_dag,
//   engine,
//   notebook
// ) => {
//   // This can be pretty ineffecient as there will be upstream cells that will re-trigger downstream cells
//   // that we have already re-ran...

//   for (let downstream_element of start_dag.out) {
//     // If the downstream element has run BEFORE the start element, it is delayed...
//     // and we need to run it again!
//     // Not to worry about the downstream of this cell, those will come eventually...
//     if (
//       (engine.cylinders[downstream_element.id]?.last_internal_run ??
//         -Infinity) <
//       (engine.cylinders[start_dag.id].last_internal_run ?? -Infinity)
//     ) {
//       return downstream_element.id;
//     }

//     let downstream_downstream = find_downstream_cells_that_are_delayed(
//       downstream_element,
//       engine,
//       notebook
//     );
//     if (downstream_downstream) {
//       return downstream_downstream;
//     }
//   }
// };

// /**
//  * @param {import("./node-engine").DAGElement} start_dag
//  * @param {import("./node-engine").Engine} engine
//  * @param {import("./node-engine").Notebook} notebook
//  * @returns {string | void}
//  */
// export let find_upstream_cells_that_are_removed = (
//   start_dag,
//   engine,
//   notebook
// ) => {
//   // This can be pretty ineffecient as there will be upstream cells that will re-trigger downstream cells
//   // that we have already re-ran...
//   for (let upstream_element of start_dag.in) {
//     if (upstream_element == null) {
//       return start_dag.id;
//     }

//     let downstream_downstream = find_upstream_cells_that_are_removed(
//       upstream_element,
//       engine,
//       notebook
//     );
//     if (downstream_downstream) {
//       return downstream_downstream;
//     }
//   }
// };

// /**
//  * @param {import("./node-engine").Engine} engine
//  * @param {import("./node-engine").Notebook} notebook
//  * @returns {[import("./node-engine").CellId, import("./node-engine").Cell] | void}
//  */
// export let get_next_cell_to_run = (engine, notebook) => {
//   let dag = cells_to_dag(notebook, engine);

//   // Figure out which cell to run
//   let cells_that_need_running = Object.entries(notebook.cells).filter(
//     ([key, cell]) => {
//       return (
//         (cell.last_run ?? -Infinity) >
//         (engine.cylinders[key]?.last_run ?? -Infinity)
//       );
//     }
//   );

//   if (cells_that_need_running.length > 0) {
//     // There is a cell that has explicitly been asked to run, so lets see if
//     // we can get that one as soon as possible.

//     let most_intensely_requested_cell_entry = sortBy(
//       cells_that_need_running,
//       ([key, cell]) => cell.last_run
//     )[0];

//     let [id, cell] = most_intensely_requested_cell_entry;
//     let cylinder = engine.cylinders[id] ?? {};

//     // We got the cell that we want to run most desperately,
//     // but lets first see if any cells in its graph need to be run first.
//     // let upstream_cells = find_upstream_cells(cell, engine, notebook);
//     // console.log(`upstream_cells:`, upstream_cells);

//     let dag = cells_to_dag(notebook, engine);

//     let start_dag = dag[id];

//     let upstream = find_cell_that_needs_running(start_dag, engine, notebook);
//     return [id, cell];
//   }

//   // Not any explicit request, BUT,
//   // we could still have upstream cells that have been removed,
//   // in case we also need to re-run
//   for (let element of Object.values(dag)) {
//     if (element.out.length === 0) {
//       let has_an_upstream_removed = find_upstream_cells_that_are_removed(
//         element,
//         engine,
//         notebook
//       );
//       if (has_an_upstream_removed) {
//         return [
//           has_an_upstream_removed,
//           notebook.cells[has_an_upstream_removed],
//         ];
//       }
//     }
//   }

//   // Not any explicit request, BUT, we could still have downstream cells that have not been
//   // executed in response yet...
//   // So lets explore that way...
//   for (let element of Object.values(dag)) {
//     if (element.in.length === 0) {
//       let downstream_delayed = find_downstream_cells_that_are_delayed(
//         element,
//         engine,
//         notebook
//       );
//       if (downstream_delayed) {
//         return [downstream_delayed, notebook.cells[downstream_delayed]];
//       }
//     }
//   }
// };

// @ts-ignore
let dag = expand_dag({
  a: ["b", "c"],
  b: ["d"],
  c: ["d"],
  d: [],
});
console.log(`dag:`, dag);

let sorted = topological_sort(dag);
console.log(`sorted:`, sorted);
