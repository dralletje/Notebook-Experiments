import { EditorView } from "@codemirror/view";
import { EditorExtension } from "../codemirror-editor-in-chief/logic";
import { add_single_cell_when_all_cells_are_removed } from "./add-cell-when-last-is-removed";
import { cell_keymap, notebook_keymap } from "./add-move-and-run-cells";
import {
  CellMetaField,
  CellTypeFacet,
  NotebookFilename,
  NotebookId,
} from "./cell";
import { CellIdOrder, cell_movement_extension } from "./cell-movement";
import { CellOrderField } from "./cell-order";
import { SelectedCellsField, selected_cells_keymap } from "./cell-selection";
import { LastCreatedCells } from "./last-created-cells";

let cell_id_order_from_notebook_facet = CellIdOrder.compute(
  [CellOrderField.field],
  (state) => state.field(CellOrderField.field)
);

export let create_codemirror_notebook = (filename, notebook) => {
  return [
    CellOrderField.init(() => {
      return notebook.cell_order.filter((x) => {
        if (notebook.cells[x]) {
          return true;
        } else {
          console.warn("cell order has cell that doesn't exist", x);
          return false;
        }
      });
    }),
    EditorExtension.of(
      CellTypeFacet.compute(
        [CellMetaField],
        (state) => state.field(CellMetaField).type
      )
    ),

    cell_id_order_from_notebook_facet,
    cell_movement_extension,

    SelectedCellsField,
    selected_cells_keymap,
    LastCreatedCells,
    add_single_cell_when_all_cells_are_removed,

    EditorExtension.of(cell_keymap),
    notebook_keymap,

    NotebookId.of(notebook.id),
    NotebookFilename.of(filename),
  ];
};
