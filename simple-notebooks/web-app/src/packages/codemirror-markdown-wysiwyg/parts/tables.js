import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

import { iterate_with_cursor } from "dral-lezer-helpers";

let markdown_styling_base_theme = EditorView.baseTheme({
  ".markdown-table": {
    color: "white",
  },
  ".cm-line:has(.markdown-table-delimiter), .cm-line:has(.markdown-table-cell)":
    {
      "background-color": "#ffffff0a",
    },
  ".markdown-table-header": {
    "font-weight": "bold",
  },
  ".markdown-table-delimiter": {
    opacity: "0.5",
  },
});

export let markdown_tables = [
  markdown_styling_base_theme,
  EditorView.decorations.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let decorations = [];
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        // Table stuff
        let table_node_to_class = {
          // Table: "markdown-table",
          TableHeader: "markdown-table-header",
          TableDelimiter: "markdown-table-delimiter",
          TableCell: "markdown-table-cell",
          // TableRow: "markdown-table-row",
        };
        let cursor_name = cursor.name;
        if (cursor_name in table_node_to_class) {
          decorations.push(
            Decoration.mark({
              class: table_node_to_class[cursor_name],
            }).range(cursor.from, cursor.to)
          );
        }
      },
    });

    return Decoration.set(decorations, true);
  }),
];
