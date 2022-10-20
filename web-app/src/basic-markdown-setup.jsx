import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit, syntaxTree } from "@codemirror/language";

import {
  EditorState,
  RangeSetBuilder,
  RangeValue,
  Range,
  Facet,
  StateField,
  StateEffect,
  StateEffectType,
  MapMode,
  EditorSelection,
} from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { iterate_over_cursor, iterate_with_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { ReactWidget, useEditorView } from "react-codemirror-widget";
import React from "react";
import emoji from "node-emoji";

import { IonIcon } from "@ionic/react";
import { eyeOutline, eye } from "ionicons/icons";
import { DecorationsFromTree } from "@dral/dral-codemirror-helpers";

let markdown_styling_base_theme = EditorView.baseTheme({
  "& .cm-content": {
    "--accent-color": "rgba(200, 0, 0)",
    "accent-color": "var(--accent-color)",
    color: "white",
  },
  "h1, h2, h3, h4, h5, h6": {
    display: "inline-block",
  },
  h1: {
    "font-size": "1.5em",
    ".cm-line:has(&)": {
      "margin-top": `0.2em`,
      "margin-bottom": `0.3em`,
    },
  },
  h2: {
    "font-size": "1.3em",
    ".cm-line:has(&)": {
      "margin-top": `0.2em`,
      "margin-bottom": `0.2em`,
    },
  },
  h3: {
    "font-size": "1.1em",
    ".cm-line:has(&)": {
      "margin-top": `0.2em`,
      "margin-bottom": `0.1em`,
    },
  },

  ".header-mark": {
    "font-variant-numeric": "tabular-nums",
    "margin-left": "calc(-1.8em - 5px)",
    opacity: 0.3,
    "font-size": "0.8em",
    display: "inline-block",
    "&.header-mark-h1": {
      "margin-right": "5px",
      "margin-left": "calc(-1.8em - 6px)",
    },
    "&.header-mark-h2": {
      "margin-right": "7px",
    },
    "&.header-mark-h3": {
      "margin-right": "9px",
    },
    "&.header-mark-h4": {
      "margin-right": "10px",
    },
    "&.header-mark-h5": {
      "margin-right": "11px",
    },
    "&.header-mark-h6": {
      "margin-right": "12px",
    },
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
    "margin-left": "-1em",
  },
  ".cm-line.order-list-item:has(.list-mark)": {
    "margin-left": "-1em",
  },
  ".cm-line.list-item:not(:has(.list-mark))": {
    /* Most likely need to tweak this for other em's */
    /* "margin-left": "5px", */
  },
  ".cm-line.list-item": {
    "margin-top": "0.3em",
    /* "margin-bottom": "0.3em", */
  },
  ".cm-line.list-item + .cm-line.list-item": {
    "margin-top": "0",
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
    "margin-left": "-25px",
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
  ".code-mark": {
    opacity: "0.5",
  },
  ".inline-code": {
    "font-size": "0.9em",
    outline: "1px solid #ffffff36",
    display: "inline-block",
    padding: "0 5px",
    margin: "0 4px",
    "border-radius": "2px",
  },
  ".cm-line.has-fenced-code": {
    border: "solid 1px #ffffff36",
    "border-radius": "5px",
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

let headers = {
  ATXHeading1: "h1",
  ATXHeading2: "h2",
  ATXHeading3: "h3",
  ATXHeading4: "h4",
  ATXHeading5: "h5",
  ATXHeading6: "h6",
};

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

let ToggleHTMLMarkerWidget = ({ show_html, line_number }) => {
  let view = useEditorView();

  return (
    <span
      onClick={() => {
        view.dispatch({
          effects: toggle_html_demo_effect.of({
            line: line_number,
            show: !show_html,
          }),
        });
      }}
      className="html-previous-toggle"
    >
      <IonIcon icon={show_html ? eye : eyeOutline} />
    </span>
  );
};

let HTMLPreviewWidget = ({ html, show_html, line_number }) => {
  return (
    <div>
      <div style={{ fontSize: "0.8em", transform: "translateX(4px)" }}>
        <ToggleHTMLMarkerWidget
          line_number={line_number}
          show_html={show_html}
        />
      </div>

      <div
        style={{
          // backgroundColor: "rgba(255,255,255,0.05)",
          whiteSpace: "normal",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

let insert_around_command = (str) => (view) => {
  let { from, to } = view.state.selection.main;
  if (from === to) return false;

  view.dispatch({
    changes: [
      { from: from, to: from, insert: str },
      { from: to, to: to, insert: str },
    ],
  });
  return true;
};

let my_markdown_keymap = keymap.of([
  {
    // TODO Add this for italic and strikethrough
    key: "Mod-b",
    run: (view) => {
      let { from, to } = view.state.selection.main;
      if (view.state.selection.main.empty) {
        view.dispatch({
          changes: { from: from, to: to, insert: "****" },
          selection: EditorSelection.single(from + 2),
        });
        return true;
      }

      if (
        view.state.doc.sliceString(from - 2, from) === "**" &&
        view.state.doc.sliceString(to, to + 2) === "**"
      ) {
        view.dispatch({
          changes: [
            { from: from - 2, to: from, insert: "" },
            { from: to, to: to + 2, insert: "" },
          ],
        });
        return true;
      }

      if (
        view.state.doc.sliceString(from, from + 2) === "**" &&
        view.state.doc.sliceString(to - 2, to) === "**"
      ) {
        view.dispatch({
          changes: [
            { from: from, to: from + 2, insert: "" },
            { from: to - 2, to: to, insert: "" },
          ],
        });
        return true;
      }

      view.dispatch({
        changes: [
          { from: from, to: from, insert: "**" },
          { from: to, to: to, insert: "**" },
        ],
      });
      return true;
    },
  },
  {
    key: "`",
    run: insert_around_command("`"),
  },
  {
    key: "*",
    run: insert_around_command("*"),
  },
  {
    key: "~",
    run: insert_around_command("~"),
  },
  {
    key: "_",
    run: insert_around_command("_"),
  },
  {
    key: "Shift-Enter",
    run: (view) => {
      let { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from: from, to: to, insert: "\n" },
        selection: { anchor: from + 1 },
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

        let insert = "\n- [ ] ";
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

/** @type {StateEffectType<{ line: number, show: boolean }>} */
let toggle_html_demo_effect = StateEffect.define();

class HTMLBlockRange extends RangeValue {
  eq(x) {
    return true;
  }
}
let html_block_range = new HTMLBlockRange();

/** @type {Facet<Array<Range<HTMLBlockRange>>, Array<Range<HTMLBlockRange>>>} */
let html_blocks_facet = Facet.define({
  combine: (x) => x[0],
});

let html_demo_statefield = StateField.define({
  create(state) {
    let intitial_html_blocks = state.facet(html_blocks_facet);
    return new Map(
      intitial_html_blocks.map((x) => [state.doc.lineAt(x.from).number, true])
    );
  },
  update(value, tr) {
    let new_map = null;

    if (tr.docChanged) {
      for (let [old_line, show] of value) {
        let old_pos = tr.startState.doc.line(old_line).from;
        let new_pos = tr.changes.mapPos(old_pos, 0, MapMode.Simple);
        let new_line =
          new_pos == null ? null : tr.newDoc.lineAt(new_pos).number;
        if (new_line !== old_line) {
          if (new_map == null) new_map = new Map(value);

          new_map.delete(old_line);
          if (new_pos) {
            new_map.set(new_line, show);
          }
        }
      }
    }

    for (let effect of tr.effects) {
      if (effect.is(toggle_html_demo_effect)) {
        if (new_map == null) {
          new_map = new Map(value);
        }
        if (effect.value.show === true) {
          new_map.set(effect.value.line, effect.value.show);
        } else {
          new_map.delete(effect.value.line);
        }
      }
    }

    if (new_map == null) {
      return value;
    } else {
      return new_map;
    }
  },
});

let html_preview_extensions = [
  EditorView.baseTheme({
    /* I apply this to the line because else the line will stay high, making
     the code look really fragile */
    ".cm-line:has(.html)": {
      "font-size": "0.8em",
      color: "#2fbf00",
    },
    ".html-previous-toggle": {
      position: "absolute",
      transform: "translateX(-100%) translateX(-10px) translateY(5px)",
      "font-size": "0.8em",
      color: "#2fbf00",
      opacity: "0.5",
    },
    ".html-previous-toggle:hover": {
      opacity: "1",
      cursor: "pointer",
    },
  }),
  html_blocks_facet.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let ranges = [];
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "HTMLBlock") {
          ranges.push(html_block_range.range(cursor.from, cursor.to));
        }
      },
    });
    return ranges;
  }),
  EditorView.decorations.compute(
    [html_blocks_facet, html_demo_statefield],
    (state) => {
      let doc = state.doc;
      let decorations = [];
      let html_ranges = state.facet(html_blocks_facet);

      for (let range of html_ranges) {
        let show_html_for_line = state.field(html_demo_statefield);
        let line_number = doc.lineAt(range.from).number;
        let show_html = show_html_for_line.get(line_number) ?? false;

        if (show_html) {
          decorations.push(
            Decoration.replace({
              block: true,
              inclusive: true,
              // inclusiveEnd: false,
              widget: new ReactWidget(
                (
                  <HTMLPreviewWidget
                    show_html={show_html}
                    line_number={line_number}
                    html={doc.sliceString(range.from, range.to)}
                  />
                )
              ),
              side: 1,
            }).range(range.from, range.to)
          );
        } else {
          decorations.push(
            Decoration.widget({
              widget: new ReactWidget(
                (
                  <ToggleHTMLMarkerWidget
                    show_html={show_html}
                    line_number={line_number}
                  />
                )
              ),
              side: -1,
            }).range(range.from, range.from)
          );
          decorations.push(
            Decoration.mark({
              tagName: "span",
              class: "html",
            }).range(range.from, range.to)
          );
        }
      }

      return Decoration.set(decorations, true);
    }
  ),
  EditorView.atomicRanges.of(({ state }) => {
    let doc = state.doc;
    let ranges = new RangeSetBuilder();
    let html_ranges = state.facet(html_blocks_facet);

    for (let range of html_ranges) {
      // Seperate because it uses `html_demo_statefield`,
      // not sure if it is better to be separate but feels good
      let show_html_for_line = state.field(html_demo_statefield);

      let line_number = doc.lineAt(range.from).number;
      let show_html = show_html_for_line.get(line_number) ?? false;
      if (show_html) {
        ranges.add(range.from, range.to, new EZRange());
      }
    }
    return ranges.finish();
  }),
  html_demo_statefield,
];

let markdown_mark_to_decoration = {
  CodeMark: Decoration.mark({ class: "code-mark" }),
  EmphasisMark: Decoration.mark({ class: "emphasis-mark" }),
  StrikethroughMark: Decoration.mark({ class: "strikethrough-mark" }),
  LinkMark: Decoration.mark({ class: "link-mark" }),
};
let markdown_inline_decorations = {
  Emphasis: "emphasis",
  Strikethrough: "strikethrough",
  StrongEmphasis: "strong-emphasis",
  Link: "link",
  URL: "url",
};
let markdown_inline_decorations_extension = [
  EditorView.baseTheme({
    ".emphasis-mark": {
      opacity: "0.5",
      "letter-spacing": "-0.1em",
      transform: "translateX(-0.05em)",
    },
    ".strikethrough-mark": {
      "text-decoration": "line-through",
      "text-decoration-color": "transparent",
      opacity: "0.5",
    },

    ".strikethrough": {
      "text-decoration": "line-through",
    },
    ".emphasis": {
      "font-style": "italic",
    },
    ".strong-emphasis": {
      "font-weight": "bold",
    },
  }),
  // These are separate because they need "lower precedence" so they don't "slice" the bigger elements:
  // `*sad*` would become `<em><mark>*</mark>sad</em><mark><em>*</em></mark>` (confusing)
  // instead of `<em><mark>*</mark>sad<mark>*</mark></em>` (normal)
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name in markdown_mark_to_decoration) {
      mutable_decorations.push(
        markdown_mark_to_decoration[cursor.name].range(cursor.from, cursor.to)
      );
    }
  }),
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name in markdown_inline_decorations) {
      mutable_decorations.push(
        Decoration.mark({
          class: markdown_inline_decorations[cursor.name],
        }).range(cursor.from, cursor.to)
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

// Show ⏎ at the end of `  ` (two spaces) lines
let show_hard_breaks = [
  EditorView.baseTheme({
    ".hard-break::after": {
      content: '"⏎"',
      color: "rgba(255, 255, 255, 0.2)",
    },
  }),
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "HardBreak") {
      mutable_decorations.push(
        Decoration.mark({
          class: "hard-break",
        }).range(cursor.from, cursor.to)
      );
    }
  }),
];

export let basic_markdown_setup = [
  markdown_styling_base_theme,

  EditorState.tabSize.of(4),
  indentUnit.of("\t"),
  placeholder("The rest is still unwritten..."),
  markdown({ addKeymap: false, base: markdownLanguage }),

  markdown_inline_decorations_extension,

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
        if (cursor.name === "HeaderMark") {
          let node = cursor.node;
          let header_tag = node.parent ? headers[node.parent.name] : "h1";
          if (header_tag == null) return;
          decorations.push(
            Decoration.replace({
              widget: new ReactWidget(
                (
                  <span className={`header-mark header-mark-${header_tag}`}>
                    {header_tag}
                  </span>
                )
              ),
            }).range(cursor.from, cursor.to)
          );
        }
        if (cursor.name in headers) {
          decorations.push(
            Decoration.mark({
              tagName: headers[cursor.name],
            }).range(cursor.from, cursor.to)
          );
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

        if (cursor.name === "InlineCode") {
          decorations.push(
            Decoration.mark({
              tagName: "code",
              class: "inline-code",
            }).range(cursor.from, cursor.to)
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
        if (cursor.name === "HeaderMark") {
          ranges.add(cursor.from, cursor.to, new EZRange());
        }
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

  // awesome_line_wrapping,
  EditorView.lineWrapping,
];
