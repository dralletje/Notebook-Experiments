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

import init2 from "find-positions-zig";
import { range } from "lodash-es";

let thing = await init2();
console.log(`thing:`, thing);

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
 * @param {Tree | TreeBuffer} tree
 * @param {Uint16Array} buffer
 */
let tree_to_big_buffer = (tree, buffer, index = 0) => {
  if (tree instanceof Tree) {
    buffer[index] = tree.type.id;
    buffer[index + 1] = tree.length;
    tree.type;
  } else {
  }
};

let make_sure_it_even = (x) => {
  return Math.ceil(x / 2) * 2;
};

let last_doc = null;
let last_doc_positions = null;
let cool_cool = (treebuffer, encoded_doc, text_offset) => {
  // console.time("Set doc");

  let doc_position = last_doc_positions;
  if (last_doc !== encoded_doc || doc_position == null) {
    let x2 = new Uint8Array(thing.exports.memory.buffer, 0);
    x2.set(encoded_doc);
    x2[encoded_doc.length] = 0;

    last_doc = encoded_doc;
    doc_position = last_doc_positions = 0;
  }
  // console.timeEnd("Set doc");

  // console.time("Set buffer");
  let treebuffer_position = make_sure_it_even(
    doc_position + encoded_doc.length + 2
  );
  // console.log(`treebuffer_position:`, treebuffer_position);
  // console.log(
  //   `treebuffer_position + treebuffer.length + 4:`,
  //   treebuffer_position + treebuffer.length + 4
  // );
  // console.log(
  //   `thing.exports.memory.buffer.length:`,
  //   thing.exports.memory.buffer.byteLength
  // );
  let x = new Uint16Array(
    thing.exports.memory.buffer,
    treebuffer_position,
    treebuffer_position + treebuffer.length + 4
  );
  x.set(treebuffer);
  x[treebuffer.length] = 0;
  x[treebuffer.length + 1] = 0;
  x[treebuffer.length + 2] = 0;
  x[treebuffer.length + 3] = 0;
  // console.timeEnd("Set buffer");

  // Make sure there is enough space for all possible positions
  // (4 u32s per positions, at most a quarter of all nodes are positions)
  //     (as the smallest collection of nodes is `Node { Position { Number Number } }` which has 1 positions for 4 nodes).
  // let nodes = treebuffer.length / 4;
  // let u32s_necessary = (nodes / 4) * 4;
  // let bytes_for_positions = u32s_necessary * 4;

  // let bytes_for_position_start = treebuffer_position + treebuffer.length + 4;
  // let total_memory_required = bytes_for_position_start + bytes_for_positions;

  // let u32 = new Uint16Array(
  //   thing.exports.memory.buffer,
  //   bytes_for_position_start,
  //   bytes_for_positions
  // );
  // u32[u32.length - 1] = 0;
  // u32[u32.length - 2] = 0;
  // u32[u32.length - 3] = 0;
  // u32[u32.length - 4] = 0;

  // console.log(`thing.exports.memory.buffer:`, thing.exports.memory.buffer)

  // console.log(`treebuffer.length / 4:`, treebuffer.length / 4);
  // console.time("META FROM TREE");
  let result = thing.exports.meta_from_tree2(
    treebuffer_position,
    treebuffer.length / 4,
    doc_position,
    text_offset,
    encoded_doc.length
    // bytes_for_position_start
  );
  // console.timeEnd("META FROM TREE");
  let aaa = new Uint32Array(thing.exports.memory.buffer, result);
  // console.log(`aaa:`, aaa);
  // console.log(`thing.exports.memory:`, thing.exports.memory);
  return aaa;
};

let encode_doc = (doc) => {
  var enc = new TextEncoder();
  return enc.encode(doc.toString());
};

/**
 * @param {{ tree: Tree | TreeBuffer, enter: (options: { tree:TreeBuffer, offset: number }) => void, offset: number }} params
 */
let iterate_trees = ({ tree, enter, offset }) => {
  if (tree instanceof Tree) {
    let child_offset = offset;
    for (let i of range(0, tree.children.length)) {
      iterate_trees({
        tree: tree.children[i],
        enter,
        offset: offset + tree.positions[i],
      });
      // child_offset += child.length;
    }
  } else {
    enter({ tree, offset });
  }
};

/**
 * @param {Text} doc
 * @param {Tree} tree
 */
export let inspector_meta_from_tree = (doc, tree) => {
  let doc_to_str = encode_doc(doc);

  // let offset = 0;
  // let current_tree = tree;
  // for (let i of xs) {
  //   offset += current_tree.positions[i];
  //   current_tree = current_tree.children[i];
  // }
  // let selectable_nodes2 = [];
  // if (current_tree?.buffer != null) {
  //   console.log(`tree:`, current_tree);
  //   let buffer = current_tree.buffer;
  //   // console.log(`weird_tree:`, weird_tree);
  //   // console.log(`buffer:`, tree.children);

  //   console.time("TREE TO BIG BUFFER");
  //   let aaa = cool_cool(buffer, doc_to_str, offset);
  //   console.timeEnd("TREE TO BIG BUFFER");
  //   console.log(`aaa:`, aaa);

  //   console.time("to ranges");
  //   for (let i = 0; i < aaa.length; i += 4) {
  //     if (aaa[i] == 0 && aaa[i + 1] == 0 && aaa[i + 2] == 0 && aaa[i + 3] == 0)
  //       break;

  //     selectable_nodes2.push({
  //       original: [aaa[i], aaa[i + 1]],
  //       cursor: [aaa[i + 2], aaa[i + 3]],
  //     });
  //   }
  //   console.log(`selectable_nodes2:`, selectable_nodes2);
  //   console.timeEnd("to ranges");
  // }

  console.log(`tree:`, tree);

  console.time("AAAAAAAA");
  let selectable_memory_stuff = [];
  let selectable_nodes3 = [];
  iterate_trees({
    tree: tree,
    offset: 0,
    enter: ({ offset, tree }) => {
      // console.time("TREE TO BIG BUFFER");

      // console.log(`tree:`, tree);
      // if (tree instanceof Tree) {
      //   selectable_nodes2.push({
      //     original: [offset, offset + tree.length],
      //     cursor: [offset, offset + tree.length],
      //   });
      // }

      // console.time("TREE TO BIG BUFFER");
      let aaa = cool_cool(tree.buffer, doc_to_str, offset);
      // console.timeEnd("TREE TO BIG BUFFER");
      // console.log(`aaa:`, aaa);

      // console.time("to ranges");
      // for (let i = 0; i < aaa.length; i += 4) {
      //   if (
      //     aaa[i] == 0 &&
      //     aaa[i + 1] == 0 &&
      //     aaa[i + 2] == 0 &&
      //     aaa[i + 3] == 0
      //   ) {
      //     // selectable_memory_stuff.push(aaa.slice(0, i));
      //     break;
      //   }

      //   selectable_nodes3.push({
      //     original: [aaa[i], aaa[i + 1]],
      //     cursor: [aaa[i + 2], aaa[i + 3]],
      //   });
      // }
      // console.timeEnd("to ranges");

      // console.timeEnd("TREE TO BIG BUFFER");
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
