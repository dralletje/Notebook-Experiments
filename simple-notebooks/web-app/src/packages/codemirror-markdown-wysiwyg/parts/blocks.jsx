import React from "react";
import { RangeSetBuilder, RangeValue } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { range } from "lodash";
import { syntaxTree } from "@codemirror/language";

import { ReactWidget, useEditorView } from "react-codemirror-widget";
import { iterate_over_cursor, iterate_with_cursor } from "dral-lezer-helpers";

let markdown_styling_base_theme = EditorView.baseTheme({
  ".cm-line.list-item:has(.list-mark)": {
    "margin-top": "0.3em",
    "margin-left": "-1em",
  },
  ".cm-line.order-list-item:has(.list-mark)": {
    "margin-left": "-1em",
  },
  ".cm-line.list-item:not(:has(.list-mark))": {
    /* Most likely need to tweak this for other em's */
    /* "margin-left": "5px", */
  },

  ".list-mark": {
    color: "transparent",
    width: "1em",
    display: "inline-block",
  },
  ".list-item:not(:has(.task-marker)) .list-mark::before": {
    content: '"-"',
    position: "absolute",
    /* top: 0; */
    transform: "translateY(-4px)",
    "font-size": "1.2em",
    color: "var(--accent-color)",
  },
  ".order-list-item:not(:has(.task-marker)) .list-mark::before": {
    content: "unset",
  },
  ".order-list-item:not(:has(.task-marker)) .list-mark": {
    color: "var(--accent-color)",
  },
  ".task-marker": {
    "margin-left": "-1em",
    transform: "translateX(-0.5em)",
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
    <input
      type="checkbox"
      className="task-marker"
      checked={checked}
      onChange={(e) => {
        let checked = e.target.checked;
        let text = checked ? "[x]" : "[ ]";
        view.dispatch({
          changes: { from: start, to: end, insert: text },
        });
      }}
    />
  );
};

let my_markdown_keymap = keymap.of([
  {
    key: "Enter",
    run: (view) => {
      let tree = syntaxTree(view.state);
      let node = tree.cursorAt(view.state.selection.main.from, -1).node;
      let { from, to } = view.state.selection.main;

      if (from !== to) {
        view.dispatch({
          changes: { from: from, to: to, insert: "\n" },
          selection: { anchor: from + 1 },
        });
        return true;
      }
      let cursor = from;

      if (node.name === "Task") {
        let node_just_before = tree.cursorAt(cursor - 1, -1).node;
        if (node_just_before.name === "TaskMarker") {
          // If there is no text in the task yet, I assume we want to get rid of the task marker
          let line = view.state.doc.lineAt(cursor);
          view.dispatch({
            changes: { from: line.from, to: cursor, insert: "\n" },
            selection: { anchor: line.from + 1 },
          });
          return true;
        }

        let current_line = view.state.doc.lineAt(cursor);
        let indentation = current_line.text.match(/^\s*/)[0];
        let insert = `\n${indentation}- [ ] `;
        view.dispatch({
          changes: { from: cursor, to: cursor, insert: insert },
          selection: { anchor: cursor + insert.length },
        });
        return true;
      }

      // TODO Same as above but for ListItem

      return false;
      // view.dispatch({
      //   changes: { from: cursor, to: cursor, insert: "\n" },
      //   selection: { anchor: cursor + 1 },
      // });
      // return true;
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
      enter: (cursor, depth) => {
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
          }).range(start, end);
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
          mutable_decorations.push(
            Decoration.replace({
              widget: new ReactWidget(
                (
                  <span className="list-mark">
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
                  <span className="list-mark">
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

export let markdown_blocks_extension = [
  markdown_styling_base_theme,
  my_markdown_keymap,

  // TODO Compute based on syntaxtree 😅
  EditorView.decorations.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let decorations = [];

    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        return search_block_or_inline_decorations({
          cursor: cursor,
          doc: state.doc,
          mutable_decorations: decorations,
        });
      },
    });
    return Decoration.set(decorations, true);
  }),

  EditorView.decorations.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let decorations = [];
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "QuoteMark") {
          let extra_space = doc.sliceString(cursor.to, cursor.to + 1) === " ";
          decorations.push(
            Decoration.replace({}).range(
              cursor.from,
              cursor.to + (extra_space ? 1 : 0)
            )
          );
        }
      },
    });

    return Decoration.set(decorations, true);
  }),

  EditorView.atomicRanges.of(({ state }) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let ranges = new RangeSetBuilder();
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "ListMark") {
          let node = cursor.node;
          if (
            node.nextSibling?.name === "Task" &&
            node.nextSibling?.firstChild?.name === "TaskMarker" &&
            doc.sliceString(
              node.nextSibling.firstChild.to,
              node.nextSibling.firstChild.to + 1
            ) === " "
          ) {
            ranges.add(
              cursor.from,
              node.nextSibling.firstChild.to + 1,
              new EZRange()
            );
          } else {
            if (state.doc.sliceString(cursor.to, cursor.to + 1) !== " ") return;
            ranges.add(cursor.from, cursor.to + 1, new EZRange());
            // This is just one character anyway, so no need to make it atomic
            // ranges.add(cursor.from, cursor.to, new EZRange());
          }
        }
      },
    });
    return ranges.finish();
  }),
];
