import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

import { iterate_with_cursor } from "dral-lezer-helpers";

let markdown_styling_base_theme = EditorView.baseTheme({
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

export let markdown_html = [
  markdown_styling_base_theme,
  EditorView.decorations.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let decorations = [];
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
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
];
