// I highly recommend you do `fold level 1` when you open this file,
// because there is a lot of thrash that becomes clear when you see the outline.
//
// Oh wait, `fold level 1` also folds the comments...
// Do expand the comments!!

import { Text } from "@codemirror/state";
import { iterate_over_cursor, iterate_trees } from "dral-lezer-helpers";
import { tags, getStyleTags } from "@lezer/highlight";
import { Tree, TreeBuffer, TreeCursor } from "@lezer/common";

// I want WASM to be very laid back and safe, so it will lazily load it
// and skip it if it fails to load.
/** @type {Awaited<ReturnType<import("@dral/find-positions-zig").default>>["meta_from_tree"]?} */
let _meta_from_tree = null;
/** @type {Awaited<ReturnType<import("@dral/find-positions-zig").default>>["reset_timing"]?} */
let _reset_timing = null;
import("@dral/find-positions-zig")
  .then(({ default: init }) => init())
  .then(({ meta_from_tree, reset_timing }) => {
    _meta_from_tree = meta_from_tree;
    _reset_timing = reset_timing;
  })
  .catch((error) => {
    // If for any reason the WASM fails to load, we'll just use the JS version
    console.error(`Error loading find-positions-zig WASM:`, error);
  });

/**
 * @typedef CursorMapping
 * @type {{
 *  cursor: import("./CodemirrorInspector.jsx").RangeTuple,
 *  original: import("./CodemirrorInspector.jsx").RangeTuple,
 * }}
 */

// This was my original method of parsing the resulting tree.
// Not very optimized, uses SyntaxNodes instead of TreeCursors,
// but it worked!
let inspector_meta_from_tree_JS = (doc, tree) => {
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
  return selectable_nodes;
};

// Then I figured, lets try writing this in WASM!
// Though it was a lot of fun, there were a lot of problems as well.
// Text parsing, hard.
// Making it actually fast... hard.
// Pffffff
// But it was actually (a bit) faster than the JS version.
let inspector_meta_from_tree_WASM = (doc, tree) => {
  if (_meta_from_tree == null || _reset_timing == null) {
    console.log("No inspector_meta_from_tree_WASM D:");
    return [];
  }
  let meta_from_tree = _meta_from_tree;
  let reset_timing = _reset_timing;

  VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE &&
    console.time("Full WASM time (includes some JS)");
  let wasm_time = 0;
  let make_ranges = 0;
  let js_time = 0;

  let selectable_nodes_from_wasm = [];
  iterate_trees({
    tree: tree,
    enter_tree: (tree, offset) => {
      let js_start = performance.now();
      if (tree.type.name === "Node") {
        let node = tree.topNode;

        let position_node = node.getChild("Position");
        if (position_node == null) return;

        let [from_str, to_str] = position_node.getChildren("Number");
        if (from_str == null || to_str == null) return;

        let name = node.firstChild;
        if (name == null) return;

        selectable_nodes_from_wasm.push({
          cursor: [name.from + offset, name.to + offset],
          original: [
            Number(
              doc.sliceString(offset + from_str.from, offset + from_str.to)
            ),
            Number(doc.sliceString(offset + to_str.from, offset + to_str.to)),
          ],
        });
      }
      js_time += performance.now() - js_start;
    },
    enter_treebuffer: (tree, offset) => {
      let wasm_start = performance.now();
      let result_array = meta_from_tree(doc, tree.buffer, offset);
      wasm_time += performance.now() - wasm_start;

      let make_ranges_start = performance.now();
      for (let i = 0; i < result_array.length; i += 4) {
        selectable_nodes_from_wasm.push({
          original: [result_array[i], result_array[i + 1]],
          cursor: [result_array[i + 2], result_array[i + 3]],
        });
      }
      make_ranges += performance.now() - make_ranges_start;
    },
  });
  VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE &&
    console.timeEnd("Full WASM time (includes some JS)");

  if (VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE) {
    console.groupCollapsed("Extra WASM timings");
    console.log(`WASM (includes memory copy time):`, wasm_time);
    console.group("WASM extra timings");
    reset_timing();
    console.groupEnd();
    console.log(`make_ranges:`, make_ranges);
    console.log(`js_time:`, js_time);
    console.groupEnd();
  }

  return selectable_nodes_from_wasm;
};

// But then I realised I was using a very unoptimised JS version...
// So yeah, turns out writing it with TreeCursors is a lot faster.
// Even faster than the WASM version D:
// Funny enough, WASM *is* faster on safari? Guess because their JS is less optimised for stuff like this.
let inspector_meta_from_tree_JS_optimized = (doc, tree) => {
  /** @type {CursorMapping[]} */
  let selectable_nodes_optimised = [];
  iterate_over_cursor({
    cursor: tree.cursor(),
    enter: (cursor) => {
      if (cursor.name === "Node") {
        if (cursor.firstChild()) {
          // Should be the name, store the from and to here
          let name_from = cursor.from;
          let name_to = cursor.to;

          try {
            // @ts-ignore Jump to positions
            while (cursor.name !== "Position" && cursor.nextSibling()) {}

            // @ts-ignore
            if (cursor.name !== "Position") throw new Error("No position?");

            if (cursor.firstChild()) {
              try {
                while (cursor.name !== "Number" && cursor.nextSibling()) {}
                if (cursor.name !== "Number") throw new Error("No position?");

                let from_number = Number(
                  doc.sliceString(cursor.from, cursor.to)
                );

                if (!cursor.nextSibling()) throw new Error("HUH");
                while (cursor.name !== "Number" && cursor.nextSibling()) {}
                if (cursor.name !== "Number")
                  throw new Error("No position 222");

                let to_number = Number(doc.sliceString(cursor.from, cursor.to));

                selectable_nodes_optimised.push({
                  cursor: [name_from, name_to],
                  original: [from_number, to_number],
                });
              } finally {
                cursor.parent();
              }
            }
          } finally {
            cursor.parent();
          }
        }
      }
    },
  });
  return selectable_nodes_optimised;
};

const VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE = false;

/**
 * @param {Text} doc
 * @param {Tree} tree
 */
export let inspector_meta_from_tree = (doc, tree) => {
  VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE &&
    console.group("inspector_meta_from_tree");
  try {
    // Using this version now, because it is by far the fastest...
    VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE && console.time("JS optimized");
    let selectable_nodes_optimised = inspector_meta_from_tree_JS_optimized(
      doc,
      tree
    );
    VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE &&
      console.timeEnd("JS optimized");

    // We are returning selectable_nodes_optimised, but in verbose mode we also
    // run the other versions to figure out how much faster it is.
    if (VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE) {
      let selectable_nodes_from_wasm = inspector_meta_from_tree_WASM(doc, tree);
      // return selectable_nodes_from_wasm;

      console.time("JS");
      let selectable_nodes_from_js = inspector_meta_from_tree_JS(doc, tree);
      console.timeEnd("JS");

      console.groupCollapsed("compare values:");
      console.log(`from_wasm:`, selectable_nodes_from_wasm);
      console.log(`from-javascript:`, selectable_nodes_from_js);
      console.log(`from-javascript-optimised:`, selectable_nodes_optimised);
      console.groupEnd();
    }

    return selectable_nodes_optimised;
  } finally {
    VERBOSE_VERSION_OF_INSPECTOR_META_FROM_TREE && console.groupEnd();
  }
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
      if (/^[a-zA-Z_0-9]*$/.test(cursor.name)) {
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
