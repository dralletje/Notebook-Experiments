import { Prec } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

// Excel style cell references
let COLUMN_REFERENCE_REGEX = /^([A-Z]{1,3})$/;
let CELL_REFERENCE_REGEX = /^([A-Z]{1,3})([0-9]+)$/;

export let highlight_cell_references = Prec.highest([
  EditorView.baseTheme({
    ".notebook-sheet-reference": {
      // color: rgba(255, 255, 255, 0.81);
      // display: inline-block;
      // text-decoration: none;
      // background-color: rgb(255, 130, 40);
      // padding: 0px 4px;
      // border-radius: 4px;
      color: "rgba(255, 255, 255, 0.81)",
      display: "inline-block",
      textDecoration: "none",
      backgroundColor: "rgb(255, 130, 40)",
      padding: "0px 4px",
      borderRadius: "4px",
    },
    ".sheet-column": {
      backgroundColor: "rgb(162 81 23)",
    },
    ".sheet-cell": {
      backgroundColor: "rgb(255, 130, 40)",
    },
  }),
  DecorationsFromTree(({ cursor, mutable_decorations, doc }) => {
    if (cursor.name === "VariableName") {
      let text = doc.sliceString(cursor.from, cursor.to);

      if (text.match(COLUMN_REFERENCE_REGEX)) {
        mutable_decorations.push(
          Decoration.mark({
            tagName: "a",
            class: "notebook-sheet-reference sheet-column",
            attributes: {
              href: `#${text}`,
            },
          }).range(cursor.from, cursor.to)
        );
      } else if (text.match(CELL_REFERENCE_REGEX)) {
        mutable_decorations.push(
          Decoration.mark({
            tagName: "a",
            class: "notebook-sheet-reference sheet-cell",
            attributes: {
              href: `#${text}`,
            },
          }).range(cursor.from, cursor.to)
        );
      }
    }
  }),
]);
