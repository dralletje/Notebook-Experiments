import React from "react";
import { EditorState, RangeSetBuilder, RangeValue } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import { range } from "lodash";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit, syntaxTree } from "@codemirror/language";
import emoji from "node-emoji";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";

import { ReactWidget, useEditorView } from "react-codemirror-widget";
import { iterate_over_cursor, iterate_with_cursor } from "dral-lezer-helpers";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

import { html_preview_extensions } from "./html-preview.jsx";
import {
  javascript_syntax_highlighting,
  my_javascript_parser,
} from "../codemirror-javascript/syntax-highlighting.js";
import { markdown_text_decorations } from "./text-marks.js";
import { markdown_headers } from "./headers.jsx";
import { show_hard_breaks } from "./show-hard-breaks.js";

let markdown_styling_base_theme = EditorView.baseTheme({
  "& .cm-content": {
    "--accent-color": "rgba(200, 0, 0)",
    "accent-color": "var(--accent-color)",
    color: "white",
  },
  "& .cm-scroller": {
    overflow: "visible",
  },
  ".link-mark": {
    opacity: 0.5,
  },
  ".link-mark, .link-mark .link": {
    color: "white",
  },
  ".link": {
    color: "var(--accent-color)",
  },
  ".url, .url .link": {
    color: "white",
    opacity: 0.5,
  },

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
  ".hr": {
    "border-top": "1px solid rgba(255, 255, 255, 0.2)",
    display: "inline-block",
    width: "100%",
    "vertical-align": "middle",
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
  ".emoji": {
    color: "var(--accent-color)",
    "font-style": "italic",
  },

  ".fenced-code": {},
  ".code-text": {
    "font-size": "0.9em",
    "font-family":
      "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
  ".fenced-code .code-mark": {
    opacity: "0.5",
  },
  ".cm-line.has-fenced-code": {
    "background-color": "#141414",
    border: "solid 1px #ffffff14",
  },
  ".cm-line.has-fenced-code + .cm-line.has-fenced-code": {
    "border-top": "none",
    "border-top-right-radius": "0",
    "border-top-left-radius": "0",
  },
  ".cm-line.has-fenced-code:has(+ .cm-line.has-fenced-code)": {
    "border-bottom": "none",
    "border-bottom-right-radius": "0",
    "border-bottom-left-radius": "0",
  },

  ".table": {
    color: "white",
  },
  ".cm-line:has(.table)": {
    "background-color": "#ffffff0a",
  },
  ".table-header": {
    "font-weight": "bold",
  },
  ".table-delimiter": {
    opacity: "0.5",
  },
  ".html-tag *": {
    color: "#2fbf00",
  },
  ".comment-block": {
    opacity: "0.5",
  },
  ".processing-instruction-block": {
    color: "#2fbf00",
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
    key: "Shift-Enter",
    run: (view) => {
      let { from, to } = view.state.selection.main;
      let current_line = view.state.doc.lineAt(from);
      let indentation = current_line.text.match(/^\s*/)[0];
      view.dispatch({
        changes: { from: from, to: to, insert: `\n${indentation}` },
        selection: { anchor: from + 1 + indentation.length },
      });
      return true;
    },
  },
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

      view.dispatch({
        changes: { from: cursor, to: cursor, insert: "\n" },
        selection: { anchor: cursor + 1 },
      });
      return true;
    },
  },
]);

let link_decorations_extension = [
  // These are separate because they need "lower precedence" so they don't "slice" the bigger elements:
  // `*sad*` would become `<em><mark>*</mark>sad</em><mark><em>*</em></mark>` (confusing)
  // instead of `<em><mark>*</mark>sad<mark>*</mark></em>` (normal)
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "LinkMark") {
      mutable_decorations.push(
        Decoration.mark({ class: "link-mark" }).range(cursor.from, cursor.to)
      );
    }
  }),
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "URL") {
      mutable_decorations.push(
        Decoration.mark({ class: "url" }).range(cursor.from, cursor.to)
      );
    }
    if (cursor.name === "Link") {
      mutable_decorations.push(
        Decoration.mark({ class: "link" }).range(cursor.from, cursor.to)
      );
    }
  }),
];

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

export let basic_markdown_setup = [
  markdown_styling_base_theme,

  EditorState.tabSize.of(4),
  indentUnit.of("\t"),
  placeholder("The rest is still unwritten..."),
  markdown({
    addKeymap: false,
    base: markdownLanguage,
    defaultCodeLanguage: my_javascript_parser,
  }),

  // TODO Tricky one, seems to not respect `scope`?
  // javascript_syntax_highlighting,

  markdown_text_decorations,
  link_decorations_extension,
  markdown_headers,

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
        if (cursor.name === "HorizontalRule") {
          let line = doc.lineAt(cursor.from);
          decorations.push(
            Decoration.replace({
              widget: new ReactWidget(<hr />),
              inclusive: true,
            }).range(line.from, line.to)
          );
        }

        if (cursor.name === "Emoji") {
          let text = doc.sliceString(cursor.from, cursor.to);
          if (emoji.hasEmoji(text)) {
            let emoji_text = emoji.get(text);
            decorations.push(
              Decoration.replace({
                widget: new ReactWidget(<span>{emoji_text}</span>),
              }).range(cursor.from, cursor.to)
            );
          } else {
            decorations.push(
              Decoration.mark({
                class: "emoji",
              }).range(cursor.from, cursor.to)
            );
          }
        }
        if (cursor.name === "FencedCode") {
          let line_from = doc.lineAt(cursor.from);
          let line_to = doc.lineAt(cursor.to);
          for (let line_number of range(line_from.number, line_to.number + 1)) {
            let line = doc.line(line_number);
            decorations.push(
              Decoration.line({
                class: "has-fenced-code",
              }).range(line.from, line.from)
            );
          }

          decorations.push(
            Decoration.mark({ tagName: "code", class: "fenced-code" }).range(
              cursor.from,
              cursor.to
            )
          );
        }
        if (cursor.name === "CodeText") {
          decorations.push(
            Decoration.mark({ class: "code-text" }).range(
              cursor.from,
              cursor.to
            )
          );
        }

        if (cursor.name === "QuoteMark") {
          let extra_space = doc.sliceString(cursor.to, cursor.to + 1) === " ";
          decorations.push(
            Decoration.replace({}).range(
              cursor.from,
              cursor.to + (extra_space ? 1 : 0)
            )
          );
        }

        // Table stuff
        let table_node_to_class = {
          Table: "table",
          TableHeader: "table-header",
          TableDelimiter: "table-delimiter",
          TableCell: "table-cell",
          TableRow: "table-row",
        };
        let cursor_name = cursor.name;
        if (cursor_name in table_node_to_class) {
          decorations.push(
            Decoration.mark({
              class: table_node_to_class[cursor_name],
            }).range(cursor.from, cursor.to)
          );
        }

        if (cursor.name === "HTMLTag") {
          decorations.push(
            Decoration.mark({ class: "html-tag" }).range(cursor.from, cursor.to)
          );
        }
        if (cursor.name === "CommentBlock") {
          decorations.push(
            Decoration.mark({ class: "comment-block" }).range(
              cursor.from,
              cursor.to
            )
          );
        }
        if (cursor.name === "ProcessingInstructionBlock") {
          decorations.push(
            Decoration.mark({ class: "processing-instruction-block" }).range(
              cursor.from,
              cursor.to
            )
          );
        }
      },
    });

    return Decoration.set(decorations, true);
  }),

  html_preview_extensions,

  EditorView.atomicRanges.of(({ state }) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let ranges = new RangeSetBuilder();
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "Emoji") {
          let text = doc.sliceString(cursor.from, cursor.to);
          if (emoji.hasEmoji(text)) {
            ranges.add(cursor.from, cursor.to, new EZRange());
          }
        }
        if (cursor.name === "HorizontalRule") {
          ranges.add(cursor.from, cursor.to, new EZRange());
        }

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

  show_hard_breaks,
  my_markdown_keymap,
  keymap.of([
    {
      key: "Tab",
      run: indentMore,
      shift: indentLess,
    },
  ]),
  keymap.of(defaultKeymap),
  drawSelection(),

  // TODO Would love to have this, but needs more looking at to work with list items and task markers
  // awesome_line_wrapping,
  EditorView.lineWrapping,
];
