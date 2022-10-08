import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

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
import {
  codeOutline,
  eyeOutline,
  eye,
  planetOutline,
  textOutline,
} from "ionicons/icons";

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
    key: "Mod-l",
    run: (view) => {
      // TODO Doing two synchonous view.dispatch'es crashes my state stuff...
      // .... Well, good I know that it does I guess
      // NOTE Not anymore!! Fixed???
      let { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from: from, to: to, insert: "CRASH" },
      });
      view.dispatch({
        changes: { from: from, to: to, insert: "MORE CRASH" },
      });
      return true;
    },
  },

  {
    key: "Mod-b",
    run: (view) => {
      let { from, to } = view.state.selection.main;
      if (from === to) return false;

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
              tagName: "code",
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

let filter_selection_in_atomic_range = EditorState.changeFilter;

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
        console.log(`depth:`, depth);
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
        console.log(`depth:`, depth);

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
  EditorState.tabSize.of(4),
  indentUnit.of("\t"),
  placeholder("The rest is still unwritten..."),
  markdown({ addKeymap: false, base: markdownLanguage }),

  // These are separate because they need "lower precedence" so they don't "slice" the bigger elements:
  // `*sad*` would become `<em><mark>*</mark>sad</em><mark><em>*</em></mark>`
  // instead of `<em><mark>*</mark>sad<mark>*</mark></em>`
  EditorView.decorations.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let decorations = [];
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name in markdown_mark_to_decoration) {
          decorations.push(
            markdown_mark_to_decoration[cursor.name].range(
              cursor.from,
              cursor.to
            )
          );
        }
      },
    });
    return Decoration.set(decorations, true);
  }),

  EditorView.decorations.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    console.log(`tree:`, tree.toString());
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

        if (cursor.name === "HardBreak") {
          decorations.push(
            Decoration.mark({
              class: "hard-break",
            }).range(cursor.from, cursor.to)
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

        if (cursor.name === "Emphasis") {
          decorations.push(
            Decoration.mark({
              class: "emphasis",
            }).range(cursor.from, cursor.to)
          );
        }
        if (cursor.name === "Strikethrough") {
          decorations.push(
            Decoration.mark({
              class: "strikethrough",
            }).range(cursor.from, cursor.to)
          );
        }
        if (cursor.name === "StrongEmphasis") {
          decorations.push(
            Decoration.mark({
              class: "strong-emphasis",
            }).range(cursor.from, cursor.to)
          );
        }

        if (cursor.name === "Link") {
          decorations.push(
            Decoration.mark({
              class: "link",
            }).range(cursor.from, cursor.to)
          );
        }
        if (cursor.name === "URL") {
          decorations.push(
            Decoration.mark({
              class: "url",
            }).range(cursor.from, cursor.to)
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
            console.log(`cursor:`, cursor);
            console.log(
              `state.doc.sliceString(cursor.to, cursor.to + 1):`,
              `"${state.doc.sliceString(cursor.to, cursor.to + 1)}"`
            );
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
