import { Decoration, EditorView } from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { syntaxTree } from "@codemirror/language";
import { DecorationsFromTreeSortForMe } from "@dral/codemirror-helpers";

import {
  javascript_syntax_highlighting,
  my_javascript_parser,
} from "../../../codemirror-javascript/syntax-highlighting.js";

let markdown_styling_base_theme = EditorView.baseTheme({
  ".fenced-code": {
    color: "#ef8e8e",
  },
  ".code-text": {
    "font-size": "0.9em",
    "font-family":
      "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
  ".fenced-code .code-mark": {
    opacity: "0.5",
  },
  ".cm-line.has-fenced-code": {
    // "background-color": "#141414",
    border: "solid 1px #ffffff14",

    // TODO Disable text-wrapping inside codeblocks for now...
    "margin-left": "0",
    "text-indent": "0",
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
});

export let markdown_code_blocks = [
  // TODO Tricky one, seems to not respect `scope`?
  // javascript_syntax_highlighting,

  markdown_styling_base_theme,
  DecorationsFromTreeSortForMe(
    ({ cursor, mutable_decorations: decorations, doc }) => {
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
          Decoration.mark({ class: "code-text" }).range(cursor.from, cursor.to)
        );
      }
    }
  ),
];
