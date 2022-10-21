import { syntaxTree } from "@codemirror/language";
import { Facet } from "@codemirror/state";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { tags, getStyleTags } from "@lezer/highlight";
import { TreeCursor } from "@lezer/common";

/**
 * @typedef CursorMapping
 * @type {{
 *  cursor: import("./CodemirrorInspector.jsx").RangeTuple,
 *  original: import("./CodemirrorInspector.jsx").RangeTuple,
 * }}
 */

/**
 * @type {Facet<CursorMapping[], CursorMapping[]>} */
export let InspectorMetaFacet = Facet.define({
  combine: (values) => values[0],
});

export let inspector_meta_from_tree = InspectorMetaFacet.compute(
  ["doc"],
  (state) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    /** @type {CursorMapping[]} */
    let selectable_nodes = [];
    iterate_over_cursor({
      cursor: tree.cursor(),
      enter: (cursor) => {
        if (cursor.name === "Node") {
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
  }
);

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
  if (tag.base == null) {
    return tags_map.get(tag);
  } else {
    return `${tag.modified
      .map((x) => modifiers_map.get(x))
      .join("(")}(${tags_map.get(tag.base)}${")".repeat(tag.modified.length)})`;
  }
};

/** @param {TreeCursor} cursor */
export let cursor_to_inspector_lang = (cursor) => {
  let lines = [];

  let current_line = "";
  if (cursor.type.isError) {
    current_line += `⚠️`;
  } else if (cursor.type.isAnonymous) {
    console.log(`cursor:`, cursor);
    throw new Error("Got a cursor with an anonymous type");
  } else {
    if (/^[A-Z_$][a-zA-Z_$0-9]*$/.test(cursor.name)) {
      current_line += cursor.name;
    } else {
      current_line += `"${cursor.name}"`;
    }
  }

  let style_tags = getStyleTags(cursor);
  if (style_tags != null && style_tags.tags.length !== 0) {
    current_line += ` [@style="${style_tags.tags
      .map((tag) => tag_to_string(tag))
      .join(", ")}"]`;
  }

  current_line += `<${cursor.from},${cursor.to}>`;

  if (cursor.firstChild()) {
    lines.push(current_line + " {");
    try {
      do {
        let { lines: sub_lines } = cursor_to_inspector_lang(cursor);
        for (let line of sub_lines) {
          lines.push(`  ${line}`);
        }
      } while (cursor.nextSibling());
    } finally {
      cursor.parent();
    }
    lines.push("}");
  } else {
    lines.push(current_line);
  }

  return { lines };
};
