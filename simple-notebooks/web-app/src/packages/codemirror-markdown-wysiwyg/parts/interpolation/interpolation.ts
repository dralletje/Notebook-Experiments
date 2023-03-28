import katex from "katex";
import "katex/dist/katex.min.css";

import { EditorView, WidgetType, Decoration } from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { syntaxTree } from "@codemirror/language";

class KatexWidget extends WidgetType {
  constructor(readonly value: string) {
    super();
    this.value = value;
  }

  toDOM() {
    const element = document.createElement("katex-widget");
    katex.render(this.value, element, {
      throwOnError: false,
      displayMode: true,
    });
    return element;
  }
  ignoreEvent(event: Event): boolean {
    return false;
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
  }),
  EditorView.decorations.compute(["doc", "selection"], (state) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let decorations = [];

    let { from, to } = state.selection.main;

    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "Interpolation") {
          console.log("Hi", cursor.from);
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
                widget: new KatexWidget(
                  doc.sliceString(cursor.from + 2, cursor.to - 2)
                ),
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
    });

    return Decoration.set(decorations, true);
  }),
];
