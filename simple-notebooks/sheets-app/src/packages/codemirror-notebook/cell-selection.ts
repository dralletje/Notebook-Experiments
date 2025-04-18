import { StateEffect } from "@codemirror/state";
import { CellId } from "./cell";
import { CellOrderEffect, CellOrderField } from "./cell-order";
import {
  EditorRemoveEffect,
  EditorInChiefKeymap,
  EditorInChiefStateField,
} from "codemirror-editor-in-chief";

export let SelectCellsEffect = StateEffect.define<CellId[]>();
export let SelectedCellsField = EditorInChiefStateField.define<CellId[]>({
  create() {
    return [];
  },

  update(selected_cells, transaction) {
    for (let effect of transaction.effects) {
      if (effect.is(SelectCellsEffect)) {
        selected_cells = effect.value;
      }
    }
    return selected_cells;
  },
});

// Keymap that interacts with the selected cells
export let selected_cells_keymap = EditorInChiefKeymap.of([
  {
    key: "Backspace",
    run: ({ state, dispatch }) => {
      // Remove cell
      let selected_cells = state.field(SelectedCellsField);
      if (selected_cells.length > 0) {
        dispatch({
          effects: selected_cells.flatMap((cell_id) => [
            CellOrderEffect.of({ cell_id: cell_id, index: null }),
            EditorRemoveEffect.of({ editor_id: cell_id }),
          ]),
        });
        return true;
      } else {
        return false;
      }
    },
  },
  {
    key: "Mod-a",
    run: ({ state, dispatch }) => {
      // Select all cells
      let cell_order = state.field(CellOrderField);
      dispatch({
        effects: [SelectCellsEffect.of(cell_order)],
      });
      return true;
    },
  },
]);
