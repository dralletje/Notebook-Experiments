import { mapValues } from "lodash-es";

type CellId = string;

type VariableName = string;
export type GraphCell = {
  id: CellId;
  imports: Array<VariableName>;
  exports: Array<VariableName>;
};

type BasicDAG = { [key: string]: string[] };
export type ExpandedDAGElement = { id: string; in: string[]; out: string[] };
export type ExpandedDAG = { [key: string]: ExpandedDAGElement };

export let cells_to_dag = (cells: Array<GraphCell>): BasicDAG => {
  return Object.fromEntries(
    cells.map((cell) => {
      return [
        cell.id,
        cell.exports.flatMap((exported) => {
          return cells
            .filter((cell) => cell.imports.includes(exported))
            .map((cell) => cell.id);
        }),
      ];
    })
  );
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

export let double_definitions = (cells: Array<GraphCell>) => {
  let cells_per_export = new Map<VariableName, GraphCell[]>();
  for (let cell of cells) {
    for (let exported of cell.exports) {
      if (!cells_per_export.has(exported)) {
        cells_per_export.set(exported, []);
      }
      cells_per_export.get(exported).push(cell);
    }
  }

  return Array.from(cells_per_export).filter(
    ([name, cells]) => cells.length > 1
  );
};

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

export let collect_upstream = (dag: ExpandedDAG, id: string): string[] => {
  let visited: string[] = [];
  let visit = (id: string) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let in_id of dag[id].in) {
      visit(in_id);
    }
  };
  visit(id);
  return visited.filter((x) => x !== id);
};

export let collect_downstream = (dag: ExpandedDAG, id: string): string[] => {
  let visited: string[] = [];
  let visit = (id: string) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let in_id of dag[id].out) {
      visit(in_id);
    }
  };
  visit(id);
  return visited.filter((x) => x !== id);
};

// ????????
export let cyclical_groups = (dag: ExpandedDAG): Array<Array<string>> => {
  let groups: Array<Array<string>> = [];
  let visited: string[] = [];
  let visit = (id: string, group: string[]) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    group.push(id);
    for (let out of dag[id].out) {
      visit(out, group);
    }
  };
  for (let id in dag) {
    let group: string[] = [];
    visit(id, group);
    if (group.length > 1) {
      groups.push(group);
    }
  }
  return groups;
};
