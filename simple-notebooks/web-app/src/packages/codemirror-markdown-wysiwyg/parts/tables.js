import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

import { iterate_with_cursor } from "dral-lezer-helpers";

let markdown_styling_base_theme = EditorView.baseTheme({
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
      },
    });

    return Decoration.set(decorations, true);
  }),
];
