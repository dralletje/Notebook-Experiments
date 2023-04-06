import { Prec } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

// Excel style cell references
let COLUMN_REFERENCE_REGEX = /^([A-Z]{1,3})$/;
let CELL_REFERENCE_REGEX = /^([A-Z]{1,3})([0-9]+)$/;

// TODO
// - Make cell highlighting styled nicer (not in this file)
// - Hovering over code should highlight all the references in that cell,
//   the reference you are hovering should just be special-er
// - Clicking on a reference should jump to the cell

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
  EditorView.domEventHandlers({
    mouseover: (event, view) => {
      let target = event.target as HTMLElement;
      if (target.matches(".notebook-sheet-reference")) {
        let cell_id = target.textContent;
        console.log(`cell_id:`, cell_id);

        // TODO Support if we put the sheet in a shadow root
        let cell_element = document.querySelector(`#${cell_id}`);
        if (cell_element) {
          cell_element.classList.add("sheet-cell-highlight");
        }
      }
    },
    mouseout: (event, view) => {
      let target = event.target as HTMLElement;
      if (target.matches(".notebook-sheet-reference")) {
        let cell_id = target.textContent;
        console.log(`cell_id:`, cell_id);

        // TODO Support if we put the sheet in a shadow root
        let cell_element = document.querySelector(`#${cell_id}`);
        if (cell_element) {
          cell_element.classList.remove("sheet-cell-highlight");
        }
      }
    },
  }),
]);
