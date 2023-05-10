import { ModernMap } from "@dral/modern-map";

// I use my own opaque here, so I can have an extra layer of opaqueness to extend these types
// import { Opaque } from "ts-opaque";
declare const opaque: unique symbol;
type Opaque<BaseType, BrandType = unknown> = BaseType & {
  readonly [opaque]: BrandType;
};

export type NodeId = Opaque<string, "NodeId">;
export type EdgeName = Opaque<string, "EdgeName">;

export type DisconnectedNode = {
  id: NodeId;
  imports: Array<{ in: EdgeName; out: EdgeName }>;
  exports: Array<{ in: EdgeName; out: EdgeName }>;
};
export type DisconnectedGraph = Array<DisconnectedNode>;

type MapOf<T extends [any, any]> = T extends [infer K, infer V]
  ? ModernMap<K, V>
  : never;

type Edge = [NodeId, { in: EdgeName; out: EdgeName }];
type CompactGraph = ModernMap<NodeId, Array<Edge>>;
export type Node = {
  id: NodeId;
  in: ReadonlyArray<Edge>;
  out: ReadonlyArray<Edge>;
};
export type Graph = ModernMap<NodeId, Node>;

export let disconnected_to_compact_graph = (
  cells: DisconnectedGraph
): CompactGraph => {
  let x = new ModernMap(
    cells.map((cell) => {
      let cell_id = cell.id;
      return [
        cell.id,
        cell.exports.flatMap((exported) => {
          return [
            ...cells.flatMap((cell) => {
              return cell.imports
                .filter((imported) => imported.in === exported.out)
                .map((imported) => {
                  return [
                    cell.id,
                    { in: imported.in, out: exported.out },
                  ] as Edge;
                });
            }),
            // .filter((cell) =>
            //   cell.imports.some((imported) => imported.in === exported.out)
            // )
            // .map(
            //   (cell) =>
            //     [cell.id, { in: exported.in, out: exported.out }] as Edge
            // ),

            // Also add cells that have an export of the same from as this cell.
            // Think of this graph more as "Cell X influences Cell Y" rather than only
            // "Cell Y uses a variable in Cell X".
            // This is because we want to be able to connect these cells later
            // for finding cycles and conflicting definitions
            ...cells
              .filter(
                (cell) =>
                  cell.exports.some(
                    (also_exported) => also_exported.out === exported.out
                  ) &&
                  cell.id !== cell_id &&
                  exported.out !== "default"
              )
              .map(
                (cell) =>
                  [cell.id, { in: exported.in, out: exported.out }] as Edge
              ),
          ];
        }),
      ];
    })
  );
  return x;
};

export let inflate_compact_graph = (graph: CompactGraph): Graph => {
  let expanded_graph = new ModernMap(
    graph.entries().map(([id, out]) => [
      id,
      {
        id,
        out: out,
        // In is filled in later...
        in: [] as Edge[],
      },
    ])
  );
  // ...specifically: here
  for (let [id, node] of expanded_graph) {
    for (let [out_id, edge] of node.out) {
      expanded_graph.get(out_id).in.push([id, edge]);
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
    let conflicting_definitions = node.out.filter(([_, { out }]) => {
      return node.in.some(([_, { in: in_name }]) => {
        return out === in_name;
      });
    });
    if (conflicting_definitions.length > 0) {
      doubles.set(
        cell_id,
        new Set(conflicting_definitions.map(([_, { out }]) => out))
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
    let index_in_group = group.findIndex(([x]) => id === x);
    if (index_in_group !== -1) {
      groups.push(group.slice(index_in_group));
      return;
    }
    if (visited.includes(id)) {
      return;
    }
    visited.push(id);
    for (let [out, edge] of graph.get(id).out) {
      visit(out, [...group, [id, edge]]);
    }
  };

  for (let id of graph.keys()) {
    let group: Array<Edge> = [];
    visit(id, group);
  }
  return groups;
};
