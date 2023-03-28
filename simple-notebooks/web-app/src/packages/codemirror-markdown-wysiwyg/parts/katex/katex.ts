import katex from "katex";
import "katex/dist/katex.min.css";

import { EditorView, WidgetType, Decoration } from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { syntaxTree } from "@codemirror/language";
import { CollectFromTree } from "@dral/codemirror-helpers";

class KatexWidget extends WidgetType {
  text: string;
  from: number;
  to: number;
  constructor({ text, from, to }: { text: string; from: number; to: number }) {
    super();
    this.text = text;
    this.from = from;
    this.to = to;
  }

  toDOM(view: EditorView) {
    const element = document.createElement("katex-widget");
    katex.render(this.text, element, {
      throwOnError: false,
      displayMode: true,
    });

    element.addEventListener("mousedown", (event) => {
      let to =
        this.to +
        (view.state.doc.sliceString(this.to - 1, this.to) === "\n" ? -1 : 0);
      view.dispatch({
        selection: { anchor: to, head: to },
      });
      setTimeout(() => {
        view.focus();
      }, 100);
    });

    return element;
  }
}

class KatexInEditWidget extends WidgetType {
  constructor(readonly value: string) {
    super();
    this.value = value;
  }

  toDOM() {
    try {
      const element = document.createElement("katex-in-edit-widget");
      katex.render(this.value, element, { displayMode: true });
      return element;
    } catch (e) {
      const element = document.createElement("katex-render-error");
      element.textContent = e.message;
      return element;
    }
  }
}

class InlineKatexWidget extends WidgetType {
  constructor(readonly value: string) {
    super();
    this.value = value;
  }

  toDOM() {
    const element = document.createElement("katex-inline-widget");
    katex.render(this.value, element, {
      throwOnError: false,
    });
    return element;
  }

  ignoreEvent(event: Event): boolean {
    return false;
  }
}

export let markdown_katex = [
  EditorView.baseTheme({
    "katex-widget": {
      display: "inline-block",
      "text-align": "center",
      width: "100%",
    },
    "katex-inline-widget": {
      display: "inline-block",
    },

    "katex-in-edit-widget": {
      position: "relative",
      // display: "block",
      display: "inline-block",
      width: "100%",
      "text-align": "center",
      "min-height": "1.5em",
    },
    "katex-render-error": {
      position: "relative",
      display: "block",
      "font-family":
        "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
      "white-space": "pre-wrap",
      color: "#ff5f5f",
      "text-align": "center",
      padding: "5px 20%",
      "font-size": "0.8em",
    },
    "katex-in-edit-widget::before, katex-render-error::before": {
      content: "''",
      position: "absolute",
      inset: "-2px 0",
      "z-index": "-1",
      "background-color": "#002f2c",
      // padding: "16px 0",
    },
    ".katex-block-code, .katex-inline-code": {
      color: "#00d7cb",
      "font-size": "85%",
      "white-space": "pre-wrap",
      "font-family":
        "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
    },
    ".has-katex-block-code": {
      // "background-color": "#00d7cb",
      border: "1px solid #002f2c",

      // TODO Disable text-wrapping inside codeblocks for now...
      "margin-left": "0",
      "text-indent": "0",
    },

    ".has-katex-block-code:has(+ .has-katex-block-code)": {
      "border-bottom": "none",
      "border-bottom-right-radius": "0",
      "border-bottom-left-radius": "0",
    },
    ".cm-line:has(.katex-block-code) + .has-katex-block-code": {
      "border-top": "none",
      "border-top-right-radius": "0",
      "border-top-left-radius": "0",
    },
  }),
  CollectFromTree({
    what: EditorView.decorations,
    with: ["selection"],
    combine: (decorations) => Decoration.set(decorations, true),
    compute: ({ cursor, accumulator: decorations, state }) => {
      let { from, to } = state.selection.main;
      let doc = state.doc;

      if (cursor.name === "KatexBlock") {
        if (cursor.node.parent.name !== "Document") {
          // TODO Support nested katex blocks, but for now... No way
          decorations.push(
            Decoration.mark({
              class: "katex-inline-code",
            }).range(cursor.from, cursor.to)
          );
          return;
        }

        if (
          (cursor.from < from && from < cursor.to) ||
          (cursor.from < to && to < cursor.to)
        ) {
          let line_from = state.doc.lineAt(cursor.from);
          let line_to = state.doc.lineAt(cursor.to);

          decorations.push(
            Decoration.widget({
              block: true,
              widget: new KatexInEditWidget(
                doc.sliceString(cursor.from + 2, cursor.to - 2)
              ),
            }).range(line_from.from, line_from.from)
          );

          for (let i of range(line_from.number, line_to.number + 1)) {
            let line = state.doc.line(i);
            decorations.push(
              Decoration.line({
                inclusive: true,
                class: "has-katex-block-code",
              }).range(line.from, line.from)
            );
          }

          decorations.push(
            Decoration.mark({
              inclusive: true,
              class: "katex-block-code",
            }).range(cursor.from, cursor.to)
          );
        } else {
          decorations.push(
            Decoration.replace({
              inclusive: true,
              // block: true,
              widget: new KatexWidget({
                text: doc.sliceString(cursor.from + 2, cursor.to - 2),
                from: cursor.from + 2,
                to: cursor.to - 2,
              }),
            }).range(cursor.from, cursor.to)
          );
        }
      }

      if (cursor.name === "KatexInline") {
        if (cursor.from <= from && to <= cursor.to) {
          decorations.push(
            Decoration.mark({
              class: "katex-inline-code",
            }).range(cursor.from, cursor.to)
          );
        } else {
          decorations.push(
            Decoration.replace({
              inclusive: true,
              // block: true,
              widget: new InlineKatexWidget(
                doc.sliceString(cursor.from + 1, cursor.to - 1)
              ),
            }).range(cursor.from, cursor.to)
          );
        }
      }
    },
  }),
];
