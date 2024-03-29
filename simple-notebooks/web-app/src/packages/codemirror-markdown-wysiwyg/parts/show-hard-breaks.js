import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

// TODO Just do this using HighlightStyle?

// Show ⏎ at the end of `  ` (two spaces) lines
export let markdown_show_hard_breaks = [
  EditorView.baseTheme({
    ".hard-break::after": {
      content: '"⏎"',
      color: "rgba(255, 255, 255, 0.2)",
      "pointer-events": "none",
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
