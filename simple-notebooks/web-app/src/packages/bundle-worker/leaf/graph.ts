import { mapValues, uniq } from "lodash-es";
import { Opaque } from "ts-opaque";

export type NodeId = Opaque<string, "NodeId">;
export type EdgeName = Opaque<string, "EdgeName">;

export type DisconnectedNode = {
  id: NodeId;
  imports: Array<EdgeName>;
  exports: Array<EdgeName>;
};
export type DisconnectedGraph = Array<DisconnectedNode>;

type MapOf<T extends [any, any]> = T extends [infer K, infer V]
  ? Map<K, V>
  : never;

type Edge = [NodeId, { name: EdgeName }];
type CompactGraph = Map<NodeId, Array<Edge>>;
export type Node = { id: NodeId; in: MapOf<Edge>; out: MapOf<Edge> };
export type Graph = Map<NodeId, Node>;

export let disconnected_to_compact_graph = (
  cells: DisconnectedGraph
): CompactGraph => {
  let x = new Map(
    cells.map((cell) => {
      let cell_id = cell.id;
      return [
        cell.id,
        cell.exports.flatMap((exported) => {
          return [
            ...cells
              .filter((cell) => cell.imports.includes(exported))
              .map((cell) => [cell.id, { name: exported }] as Edge),

            // Also add cells that have an export of the same name as this cell.
            // Think of this graph more as "Cell X influences Cell Y" rather than only
            // "Cell Y uses a variable in Cell X".
            // This is because we want to be able to connect these cells later
            // for finding cycles and conflicting definitions
            ...cells
              .filter(
                (cell) => cell.exports.includes(exported) && cell.id !== cell_id
              )
              .map((cell) => [cell.id, { name: exported }] as Edge),
          ];
        }),
      ];
    })
  );
  return x;
};

export let inflate_compact_graph = (graph: CompactGraph): Graph => {
  let expanded_graph: Graph = new Map(
    Array.from(graph).map(([id, out]) => [
      id,
      {
        id,
        out: new Map(out),
        // In is filled in later...
        in: new Map(),
      },
    ])
  );
  // ...specifically: here
  for (let [id, node] of expanded_graph) {
    for (let [out_id, { name }] of node.out) {
      expanded_graph.get(out_id).in.set(id, { name });
    }
  }
  return expanded_graph;
};

export let topological_sort = (graph: Graph): NodeId[] => {
  let sorted: NodeId[] = [];
  let visited: NodeId[] = [];
  let visit = (id: NodeId) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let [out] of graph.get(id).in) {
      visit(out);
    }
    sorted.push(id);
  };
  for (let id of graph.keys()) {
    visit(id);
  }
  return sorted;
};

/**
 * Returns a map of cell_id to a list of variable names that are defined multiple times.
 * This is used to find conflicting definitions.
 *
 * TODO Now it only returns the names of the conflicting definitions, but it should also
 * return the cell_ids of those definitions.
 */
export let multiple_definitions = (graph: Graph) => {
  let doubles = new Map<NodeId, Set<EdgeName>>();
  for (let [cell_id, node] of graph.entries()) {
    let conflicting_definitions = Array.from(node.out.values()).filter(
      ({ name: out_name }) => {
        return Array.from(node.in.values()).some(({ name: in_name }) => {
          return out_name === in_name;
        });
      }
    );
    if (conflicting_definitions.length > 0) {
      doubles.set(
        cell_id,
        new Set(
          Array.from(conflicting_definitions.values()).map(({ name }) => name)
        )
      );
    }
  }
  return doubles;
};

export let upstream = (graph: Graph, id: NodeId): NodeId[] => {
  let visited: NodeId[] = [];
  let visit = (id: NodeId) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let in_id of graph.get(id).in) {
      visit(in_id[0]);
    }
  };
  visit(id);
  return visited.filter((x) => x !== id);
};

export let downstream = (graph: Graph, id: NodeId): NodeId[] => {
  let visited: NodeId[] = [];
  let visit = (id: NodeId) => {
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let in_id of graph.get(id).out) {
      visit(in_id[0]);
    }
  };
  visit(id);
  return visited.filter((x) => x !== id);
};

export let cycles = (graph: Graph): Array<Array<Edge>> => {
  let groups: Array<Array<Edge>> = [];
  let visited: NodeId[] = [];
  let visit = (id: NodeId, group: Array<Edge>) => {
    if (group.some(([x]) => id === x)) {
      groups.push(group);
      return;
    }
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let [out, { name }] of graph.get(id).out) {
      let x = visit(out, [...group, [id, { name }]]);
    }
  };

  for (let id of graph.keys()) {
    let group: Array<Edge> = [];
    visit(id, group);
  }
  return groups;
};
