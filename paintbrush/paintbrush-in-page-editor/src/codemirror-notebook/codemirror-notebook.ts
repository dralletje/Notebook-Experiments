import { EditorExtension } from "../codemirror-editor-in-chief/logic";
import { add_single_cell_when_all_cells_are_removed } from "./add-cell-when-last-is-removed";
import { cell_keymap, notebook_keymap } from "./add-move-and-run-cells";
import { NotebookSerialized } from "./cell";
import { cell_movement_extension } from "./cell-movement";
import { CellOrderField } from "./cell-order";
import { SelectedCellsField, selected_cells_keymap } from "./cell-selection";
import { LastCreatedCells } from "./last-created-cells";

export let create_codemirror_notebook = (notebook: NotebookSerialized) => {
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

    cell_movement_extension,

    SelectedCellsField,
    selected_cells_keymap,
    LastCreatedCells,
    add_single_cell_when_all_cells_are_removed,

    EditorExtension.of(cell_keymap),
    notebook_keymap,
  ];
};