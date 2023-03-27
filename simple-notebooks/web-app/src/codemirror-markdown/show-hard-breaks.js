import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

// Show ⏎ at the end of `  ` (two spaces) lines
export let show_hard_breaks = [
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
