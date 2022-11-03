import { Text } from "@codemirror/state";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { tags, getStyleTags } from "@lezer/highlight";
import { Tree, TreeBuffer, TreeCursor } from "@lezer/common";

/**
 * @typedef CursorMapping
 * @type {{
 *  cursor: import("./CodemirrorInspector.jsx").RangeTuple,
 *  original: import("./CodemirrorInspector.jsx").RangeTuple,
 * }}
 */

import init_meta_from_tree from "find-positions-zig";
import { range } from "lodash-es";

let meta_from_tree = await init_meta_from_tree();

// console.log(`thing:`, thing);
// let array = new Uint8Array([1, 2, 3, 4, 5, 6]);
// let result = thing.exports.meta_from_tree2(array);
// console.log(`thing:`, result);
// console.log(`thing.exports.memory:`, thing.exports.memory);
// console.log(`array:`, array);

// let aaa = new Uint8Array(thing.exports.memory.buffer, result);
// console.log(`aaa:`, aaa);

// fetch(new URL("find-positions-zig", import.meta.url))

//  return FileAttachment("main.wasm")
//  .arrayBuffer()
//  .then((bytes) => WebAssembly.instantiate(bytes, imports))
//  .then((results) => (instance = results.instance));

/**
 * @param {{
 *  tree: Tree | TreeBuffer,
 *  enter: (options: { tree: TreeBuffer | Tree, offset: number }) => void | false,
 *  offset: number,
 *  verbose?: boolean,
 * }} params
 */
let iterate_trees = ({ tree, enter, offset, verbose }) => {
  if (tree instanceof Tree) {
    verbose && console.group(`TREE "${tree.type.name}" ${offset}`);
    verbose && console.log(`tree:`, tree);

    let should_enter = enter({ tree, offset });

    if (should_enter !== false) {
      for (let i of range(0, tree.children.length)) {
        iterate_trees({
          tree: tree.children[i],
          enter,
          offset: offset + tree.positions[i],
        });
      }
    }
    verbose && console.groupEnd();
  } else {
    verbose && console.group(`BUFFER ${offset}`);
    enter({ tree, offset });
    verbose && console.groupEnd();
  }
};

/**
 * @param {Text} doc
 * @param {Tree} tree
 */
export let inspector_meta_from_tree = (doc, tree) => {
  console.time("AAAAAAAA");
  let selectable_nodes3 = [];
  iterate_trees({
    tree: tree,
    offset: 0,
    enter: ({ offset, tree }) => {
      if (tree instanceof Tree) {
        if (tree.type.name === "Node") {
          let node = tree.topNode;
          let position_node = node.getChild("Position");
          if (position_node == null) return;
          let [from_str, to_str] = position_node.getChildren("Number");
          if (from_str == null || to_str == null) return;
          let name = node.firstChild;
          if (name == null) return;

          selectable_nodes3.push({
            cursor: [name.from + offset, name.to + offset],
            original: [
              Number(
                doc.sliceString(offset + from_str.from, offset + from_str.to)
              ),
              Number(doc.sliceString(offset + to_str.from, offset + to_str.to)),
            ],
          });
        }
      } else {
        let aaa = meta_from_tree(doc, tree.buffer, offset);

        // console.time("to ranges");
        for (let i = 0; i < aaa.length; i += 4) {
          selectable_nodes3.push({
            original: [aaa[i], aaa[i + 1]],
            cursor: [aaa[i + 2], aaa[i + 3]],
          });
        }
      }
    },
  });
  console.timeEnd("AAAAAAAA");

  // return selectable_nodes3;
  // console.log(`selectable_memory_stuff:`, selectable_memory_stuff);

  console.time("inspector_meta_from_tree");
  /** @type {CursorMapping[]} */
  let selectable_nodes = [];
  iterate_over_cursor({
    cursor: tree.cursor(),
    enter: (cursor) => {
      // if (cursor.buffer != null) {
      //   console.log(`cursor.buffer:`, cursor.buffer);
      //   cool_cool(cursor.buffer.buffer, doc.toString());
      //   return false;
      // }

      if (cursor.name === "Node") {
        // console.log(`cursor.type:`, cursor.type);
        let node = cursor.node;
        let position_node = node.getChild("Position");
        if (!position_node) return;
        let [from_str, to_str] = position_node.getChildren("Number");
        if (!from_str || !to_str) return;

        if (cursor.firstChild()) {
          // Name
          selectable_nodes.push({
            cursor: [cursor.from, cursor.to],
            original: [
              Number(doc.sliceString(from_str.from, from_str.to)),
              Number(doc.sliceString(to_str.from, to_str.to)),
            ],
          });
          cursor.parent();
        }
      }
    },
  });
  console.timeEnd("inspector_meta_from_tree");
  console.log(`selectable_nodes3:`, selectable_nodes3);
  console.log(`selectable_nodes:`, selectable_nodes);
  return selectable_nodes;
};

let tags_map = new Map(
  Object.entries(tags)
    .filter(([_, value]) => typeof value !== "function")
    .map(([k, v]) => [v, k])
);

let modifiers_map = new Map(
  Object.entries(tags)
    .filter(([_, value]) => typeof value === "function")
    // @ts-ignore
    .map(([k, v]) => [v(tags.variableName).modified[0], k])
);

let tag_to_string = (tag) => {
  if (tag == null) {
    return "<>";
  }
  if (tag.base == null) {
    return tags_map.get(tag);
  } else {
    return `${tag.modified
      .map((x) => modifiers_map.get(x))
      .join("(")}(${tags_map.get(tag.base)}${")".repeat(tag.modified.length)})`;
  }
};

let tree_to_inspector_lang_weakmap = new WeakMap();

/** @param {TreeCursor} cursor */
export let _cursor_to_inspector_lang = (cursor, indent = "") => {
  let text = "";

  text += indent;
  if (cursor.type.isError) {
    text += `⚠`;
  } else if (cursor.type.isAnonymous) {
    text += `🔘`;
  } else {
    if (/^[A-Z_$][a-zA-Z_$0-9]*$/.test(cursor.name)) {
      text += cursor.name;
    } else {
      text += `"${cursor.name}"`;
    }
  }

  let tags = [];

  let style_tags = getStyleTags(cursor);
  if (style_tags != null && style_tags.tags.length !== 0) {
    tags.push([
      "style",
      style_tags.tags.map((tag) => tag_to_string(tag)).join(", "),
    ]);
  }

  if (cursor.tree != null) {
    if (tree_to_inspector_lang_weakmap.has(cursor.tree)) {
      tags.push(["tree", "refurbished"]);
    } else {
      tags.push(["tree", "fresh"]);
    }
  }

  if (tags.length > 0) {
    text += ` [${tags.map(([k, v]) => `${k}="${v}"`).join(", ")}]`;
  }

  text += `<${cursor.from},${cursor.to}>`;

  if (cursor.firstChild()) {
    text += " {\n";
    if (
      cursor.tree != null &&
      tree_to_inspector_lang_weakmap.has(cursor.tree)
    ) {
      text += tree_to_inspector_lang_weakmap.get(cursor.tree);
    } else {
      let child_text = "";
      try {
        do {
          let { text: subtext } = _cursor_to_inspector_lang(
            cursor,
            indent + "  "
          );
          child_text += subtext + "\n";
        } while (cursor.nextSibling());
      } finally {
        cursor.parent();
      }
      if (cursor.tree != null) {
        tree_to_inspector_lang_weakmap.set(cursor.tree, child_text);
      }
      text += child_text;
    }

    text += indent + "}";
  }

  return { text };
};

/**
 * This is (barely) faster than the recursive function above...
 * BUT it could be converted to a generator so be executed piece by piece later...
 * Now I think of it, the recursive function could be as well, with `yield*`, could be a nice experiment some day.
 * @param {TreeCursor} cursor
 * @returns {{ lines: string[] }}
 */
export let cursor_to_inspector_lang = (cursor) => {
  let lines = [];
  let indents = [""];

  node_loop: while (true) {
    let first_line_of_this_node = "";
    first_line_of_this_node += indents[0];
    if (cursor.type.isError) {
      first_line_of_this_node += `⚠`;
    } else if (cursor.type.isAnonymous) {
      first_line_of_this_node += `🔘`;
    } else {
      if (/^[a-zA-Z_$0-9]*$/.test(cursor.name)) {
        first_line_of_this_node += cursor.name;
      } else {
        first_line_of_this_node += `"${cursor.name}"`;
      }
    }

    let tags = [];
    let style_tags = getStyleTags(cursor);
    if (style_tags != null && style_tags.tags.length !== 0) {
      tags.push([
        "style",
        style_tags.tags.map((tag) => tag_to_string(tag)).join(", "),
      ]);
    }
    if (cursor.tree != null) {
      if (tree_to_inspector_lang_weakmap.has(cursor.tree)) {
        tags.push(["tree", "refurbished"]);
      } else {
        tags.push(["tree", "fresh"]);
      }
    }

    if (tags.length > 0) {
      first_line_of_this_node += ` [${tags
        .map(([k, v]) => `${k}="${v}"`)
        .join(", ")}]`;
    }

    first_line_of_this_node += `<${cursor.from},${cursor.to}>`;

    if (cursor.firstChild()) {
      first_line_of_this_node += " {";
      lines.push(first_line_of_this_node);

      indents.unshift(indents[0] + "  ");
      continue node_loop;
    } else if (cursor.nextSibling()) {
      first_line_of_this_node += "";
      lines.push(first_line_of_this_node);
      continue node_loop;
    } else {
      lines.push(first_line_of_this_node);
      while (cursor.parent()) {
        indents.shift();
        lines.push(indents[0] + "}");
        if (cursor.nextSibling()) {
          continue node_loop;
        }
      }
      break node_loop;
    }
  }
  return { lines: lines };
};
