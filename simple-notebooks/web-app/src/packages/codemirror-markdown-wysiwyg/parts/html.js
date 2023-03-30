import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

// TODO "just" do this using HighlightStyle?
// TODO Some way to share the mono font family with all parts?

export let markdown_html = [
  EditorView.baseTheme({
    ".html-tag": {
      color: "#2fbf00",
      "font-family": "menlo",
      "font-size": "85%",
    },
    ".comment-block": {
      opacity: "0.5",
    },
    ".processing-instruction-block": {
      color: "#2fbf00",
    },
  }),
  DecorationsFromTree(({ cursor, mutable_decorations: decorations, doc }) => {
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
  }),
];
