import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTreeSortForMe } from "@dral/codemirror-helpers";

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

let table_node_to_class = {
  // Table: "markdown-table",
  TableHeader: "markdown-table-header",
  TableDelimiter: "markdown-table-delimiter",
  TableCell: "markdown-table-cell",
  // TableRow: "markdown-table-row",
};

export let markdown_tables = [
  markdown_styling_base_theme,
  DecorationsFromTreeSortForMe(
    ({ cursor, mutable_decorations: decorations }) => {
      // Table stuff
      if (cursor.name in table_node_to_class) {
        decorations.push(
          Decoration.mark({
            class: table_node_to_class[cursor.name],
          }).range(cursor.from, cursor.to)
        );
      }
    }
  ),
];
