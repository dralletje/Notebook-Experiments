import { mapValues } from "lodash-es";

type CellId = string;

type VariableName = string;

export type DisconnectedNode = {
  id: CellId;
  imports: Array<VariableName>;
  exports: Array<VariableName>;
};
export type DisconnectedGraph = Array<DisconnectedNode>;

type Edge = [string, { name: string }];
type CompactGraph = { [key: string]: Array<Edge> };
export type GraphElement = { id: string; in: Edge[]; out: Edge[] };
export type Graph = { [key: string]: GraphElement };

export let disconnected_to_compact_graph = (
  cells: DisconnectedGraph
): CompactGraph => {
  let x = Object.fromEntries(
    cells.map((cell) => {
      let cell_id = cell.id;
      return [
        cell.id,
        cell.exports.flatMap((exported) => {
          return [
            ...cells
              .filter((cell) => cell.imports.includes(exported))
              .map((cell) => [cell.id, { name: exported }] as const),

            // Also add cells that have an export of the same name as this cell.
            // Think of this graph more as "Cell X influences Cell Y" rather than only
            // "Cell Y uses a variable in Cell X".
            // This is because we want to be able to connect these cells later
            // for finding cycles and conflicting definitions
            ...cells
              .filter(
                (cell) => cell.exports.includes(exported) && cell.id !== cell_id
              )
              .map((cell) => [cell.id, { name: exported }] as const),
          ];
        }) as any,
      ];
    })
  );
  return x;
};

export let inflate_compact_graph = (graph: CompactGraph): Graph => {
  let expanded_graph: Graph = mapValues(graph, (out, id) => ({
    id,
    out,
    in: [],
  })) as any;
  for (let in_id of Object.keys(expanded_graph)) {
    for (let [out_id, { name }] of expanded_graph[in_id].out) {
      expanded_graph[out_id].in.push([in_id, { name }]);
    }
  }
  return expanded_graph;
};

export let topological_sort = (graph: Graph): string[] => {
  let sorted: string[] = [];
  let visited: string[] = [];
  let visit = (edge: string) => {
    if (visited.includes(edge)) {
      return;
    }
    visited.push(edge);
    for (let [out] of graph[edge].in) {
      visit(out);
    }
    sorted.push(edge);
  };
  for (let id in graph) {
    visit(id);
  }
  return sorted;
};

export let double_definitions = (graph: Graph) => {
  let doubles = new Map<CellId, VariableName[]>();
  for (let [cell_id, node] of Object.entries(graph)) {
    let conflicting_definitions = node.out.filter(
      ([out_id, { name: out_name }]) => {
        return node.in.some(([in_id, { name: in_name }]) => {
          return out_name === in_name;
        });
      }
    );
    if (conflicting_definitions.length > 0) {
      doubles.set(
        cell_id,
        conflicting_definitions.map(([out_id, { name }]) => name)
      );
    }
  }
  return doubles;
};

export let upstream = (graph: Graph, id: string): string[] => {
  let visited: string[] = [];
  let visit = (id: string) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let in_id of graph[id].in) {
      visit(in_id[0]);
    }
  };
  visit(id);
  return visited.filter((x) => x !== id);
};

export let downstream = (graph: Graph, id: string): string[] => {
  let visited: string[] = [];
  let visit = (id: string) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let in_id of graph[id].out) {
      visit(in_id[0]);
    }
  };
  visit(id);
  return visited.filter((x) => x !== id);
};

// ????????
export let cycles = (graph: Graph): Array<Array<Edge>> => {
  let groups: Array<Array<Edge>> = [];
  let visited: string[] = [];
  let visit = (id: string, group: Array<Edge>) => {
    if (group.some(([x]) => id === x)) {
      groups.push(group);
      return;
    }
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let [out, { name }] of graph[id].out) {
      let x = visit(out, [...group, [id, { name }]]);
    }
  };

  for (let id in graph) {
    let group: Array<Edge> = [];
    visit(id, group);
  }
  return groups;
};
