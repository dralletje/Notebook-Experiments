import React from "react";
import {
  EditorSelection,
  EditorState,
  RangeSetBuilder,
  RangeValue,
} from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { range } from "lodash";
import { syntaxTree } from "@codemirror/language";

import { ReactWidget, useEditorView } from "react-codemirror-widget";
import { iterate_over_cursor, iterate_with_cursor } from "dral-lezer-helpers";
import { TreeCursor } from "@lezer/common";
import { DecorationsFromTreeSortForMe } from "@dral/codemirror-helpers";

let markdown_styling_base_theme = EditorView.baseTheme({
  ".cm-line.list-item:has(.list-mark),.cm-line.list-item:has(.task-marker)": {
    // Don't ask me why this is padding, but it works better with selection stuff
    "padding-top": "0.3em",
  },

  ".list-mark": {
    display: "inline-block",
    width: "1em",
    "margin-left": "calc(-1em)", // 1px so codemirror puts the cursor at the right place

    "font-weight": "bold",
    color: "var(--accent-color)",
  },
  ".task-marker": {
    display: "inline-block",
    width: "1em",
    "margin-left": "calc(-1em)", // 1px so codemirror puts the cursor at the right place
  },

  ".list-mark.ul": {
    "font-size": "0.8em",
    width: "1.25em",
    "margin-left": "-1.25em",
  },

  ".quote-mark": {
    color: "transparent",
    "font-size": "0",
    display: "inline-block",
    position: "relative",
  },
  ".blockquote": {
    position: "relative",
  },
  ".blockquote::before": {
    content: '""',
    position: "absolute",
    "margin-left": "0.2em",
    "pointer-events": "none",
    "font-size": "1.2em",
    "background-color": "rgba(200, 0, 0)",
    width: "0.16em",
    top: "0",
    bottom: "0",
    left: "-0.6em",
  },
});

class EZRange extends RangeValue {
  eq() {
    return true;
  }
}

let TaskMarkerWidget = ({ checked, start, end }) => {
  let view = useEditorView();

  return (
    <span className="task-marker">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          let checked = e.target.checked;
          let text = checked ? "[x]" : "[ ]";
          view.dispatch({
            changes: { from: start, to: end, insert: text },
          });
        }}
      />
    </span>
  );
};

let AAAAA = keymap.of([
  {
    key: "Backspace",
    run: ({ state, dispatch }) => {
      if (!state.selection.main.empty) return false;

      let position = state.selection.main.from;
      let line = state.doc.lineAt(position);
      let tree = syntaxTree(state);
      let cursor = tree.cursorAt(position, -1);

      if (cursor.name !== "ListItem" && cursor.name !== "Task") return false;
      cursor.firstChild(); // Marker

      // cursor.to is end of marker, + 1 is the space after the marker
      if (cursor.to + 1 === position) {
        dispatch({
          changes: {
            from: line.from,
            to: position,
            insert: "",
          },
        });
        return true;
      }
      return false;
    },
  },
  {
    key: "Enter",
    run: ({ state, dispatch }) => {
      let tree = syntaxTree(state);
      let { from, to } = state.selection.main;
      let cursor = tree.cursorAt(from, -1);
      let line = state.doc.lineAt(from);

      if (from !== to) return false;

      while (
        cursor.node.name !== "ListItem" &&
        cursor.node.name !== "Task" &&
        cursor.parent()
      ) {}

      if (cursor.node.name !== "ListItem" && cursor.node.name !== "Task")
        return false;

      let item_line = state.doc.lineAt(cursor.from);

      // if (line.number !== state.doc.lineAt(cursor.from).number) return false;

      cursor.firstChild(); // Marker of the list

      // TODO Not sure if I should use `line` or `item_line` here
      let rest_of_line = state.doc.sliceString(cursor.to + 1, line.to);
      if (rest_of_line.trim() === "") {
        dispatch({
          changes: { from: line.from, to: line.to, insert: `` },
          selection: EditorSelection.cursor(line.from),
        });
        return true;
      }

      let prefix = state.doc
        .sliceString(item_line.from, cursor.to)
        .replace("[x]", "[ ]");
      dispatch({
        changes: { from: to, to: to, insert: `\n${prefix} ` },
        selection: { anchor: to + 1 + prefix.length + 1 },
      });
      return true;
    },
  },
]);

let search_block_or_inline_decorations = ({
  cursor,
  doc,
  mutable_decorations,
}) => {
  if (cursor.name === "Blockquote") {
    let line_from = doc.lineAt(cursor.from);
    let line_to = doc.lineAt(cursor.to);
    mutable_decorations.push(
      Decoration.line({
        class: "blockquote",
      }).range(line_from.from, line_from.from)
    );
    for (let line_number of range(line_from.number + 1, line_to.number + 1)) {
      let line = doc.line(line_number);
      mutable_decorations.push(
        Decoration.line({
          class: "blockquote",
        }).range(line.from, line.from)
      );
    }
  }

  if (cursor.name === "BulletList") {
    iterate_over_cursor({
      cursor: cursor,
      enter: (/** @type {TreeCursor} */ cursor, depth) => {
        if (depth === 0) return;
        search_block_or_inline_decorations({
          cursor,
          doc,
          mutable_decorations,
        });

        if (cursor.name === "TaskMarker") {
          let start = cursor.from;
          let end = cursor.to;

          if (doc.sliceString(end, end + 1) !== " ") {
            return;
          }

          let text = doc.sliceString(start, end);
          let checked = text === "[x]";
          let decoration = Decoration.replace({
            widget: new ReactWidget(
              <TaskMarkerWidget checked={checked} start={start} end={end} />
            ),
          }).range(start, end + 1);
          mutable_decorations.push(decoration);
        }

        if (cursor.name === "ListItem") {
          let line_from = doc.lineAt(cursor.from);
          let line_to = doc.lineAt(cursor.to);
          mutable_decorations.push(
            Decoration.line({
              class: "list-item has-list-mark",
            }).range(line_from.from, line_from.from)
          );
          for (let line_number of range(
            line_from.number + 1,
            line_to.number + 1
          )) {
            let line = doc.line(line_number);
            mutable_decorations.push(
              Decoration.line({
                class: "list-item",
              }).range(line.from, line.from)
            );
          }
        }

        if (cursor.name === "ListMark") {
          if (doc.sliceString(cursor.to, cursor.to + 1) !== " ") {
            return;
          }
          let possibly_task = cursor.node.nextSibling;
          if (possibly_task?.name === "Task") {
            let task_marker = possibly_task.firstChild;
            if (task_marker?.name !== "TaskMarker") return;
            if (doc.sliceString(task_marker.to, task_marker.to + 1) !== " ")
              return;

            let decoration = Decoration.replace({}).range(
              cursor.from,
              cursor.to + 1 // Include the space
            );
            mutable_decorations.push(decoration);
            return;
          } else {
            mutable_decorations.push(
              Decoration.replace({
                widget: new ReactWidget(
                  (
                    <span className="list-mark ul">
                      {doc.sliceString(cursor.from, cursor.to)}
                    </span>
                  )
                ),
              }).range(cursor.from, cursor.to + 1)
            );
            return;
          }
        }
      },
    });
    return false;
  }

  if (cursor.name === "OrderedList") {
    iterate_over_cursor({
      cursor: cursor,
      enter: (cursor, depth) => {
        if (depth === 0) return;

        search_block_or_inline_decorations({
          cursor,
          doc,
          mutable_decorations,
        });

        if (cursor.name === "ListItem") {
          let line_from = doc.lineAt(cursor.from);
          let line_to = doc.lineAt(cursor.to);
          mutable_decorations.push(
            Decoration.line({
              class: "order-list-item has-list-mark",
            }).range(line_from.from, line_from.from)
          );
          for (let line_number of range(
            line_from.number + 1,
            line_to.number + 1
          )) {
            let line = doc.line(line_number);
            mutable_decorations.push(
              Decoration.line({
                class: "order-list-item",
              }).range(line.from, line.from)
            );
          }
        }
        if (cursor.name === "ListMark") {
          if (doc.sliceString(cursor.to, cursor.to + 1) !== " ") {
            return;
          }
          mutable_decorations.push(
            Decoration.replace({
              widget: new ReactWidget(
                (
                  <span className="list-mark ol">
                    {doc.sliceString(cursor.from, cursor.to)}
                  </span>
                )
              ),
            }).range(cursor.from, cursor.to + 1)
          );
        }
      },
    });
    return false;
  }
};

export let markdown_lists_and_quotes = [
  markdown_styling_base_theme,

  AAAAA,

  DecorationsFromTreeSortForMe(search_block_or_inline_decorations),

  DecorationsFromTreeSortForMe(
    ({ cursor, mutable_decorations: decorations, doc }) => {
      if (cursor.name === "QuoteMark") {
        let extra_space = doc.sliceString(cursor.to, cursor.to + 1) === " ";
        decorations.push(
          Decoration.replace({}).range(
            cursor.from,
            cursor.to + (extra_space ? 1 : 0)
          )
        );
      }
    }
  ),

  EditorView.atomicRanges.of(({ state }) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let ranges = new RangeSetBuilder();
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "ListMark") {
          let node = cursor.node;
          let line = doc.lineAt(node.from);
          let previous_line_start =
            line.number === 1 ? line.from : line.from - 1;

          if (
            node.nextSibling?.name === "Task" &&
            node.nextSibling?.firstChild?.name === "TaskMarker" &&
            doc.sliceString(
              node.nextSibling.firstChild.to,
              node.nextSibling.firstChild.to + 1
            ) === " "
          ) {
            ranges.add(
              previous_line_start,
              node.nextSibling.firstChild.to + 1,
              new EZRange()
            );
          } else {
            if (state.doc.sliceString(cursor.to, cursor.to + 1) !== " ") return;
            ranges.add(previous_line_start, cursor.to + 1, new EZRange());
            // This is just one character anyway, so no need to make it atomic
            // ranges.add(cursor.from, cursor.to, new EZRange());
          }
        }
      },
    });
    return ranges.finish();
  }),
];
