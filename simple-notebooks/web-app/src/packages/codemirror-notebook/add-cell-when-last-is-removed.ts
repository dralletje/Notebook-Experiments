import { EditorState, Extension } from "@codemirror/state";
import {
  EditorAddEffect,
  EditorInChief,
} from "../codemirror-editor-in-chief/editor-in-chief";
import { CellOrderField, CellOrderEffect } from "./cell-order";
import { empty_cell } from "./cell";
import { NoAnimation } from "./last-created-cells";
import { create_cell_state } from "../../Notebook/notebook-utils";

export let add_single_cell_when_all_cells_are_removed =
  EditorState.transactionExtender.of((transaction) => {
    let cell_order = transaction.startState.field(CellOrderField.field);
    let cells_left_after_effects = new Set(cell_order);

    for (let effect of transaction.effects) {
      if (effect.is(CellOrderEffect)) {
        if (effect.value.index == null) {
          cells_left_after_effects.delete(effect.value.cell_id);
        } else {
          cells_left_after_effects.add(effect.value.cell_id);
        }
      }
    }

    // Add a cell when the last cell is removed
    if (cells_left_after_effects.size === 0) {
      let new_cell = empty_cell();
      return {
        annotations: NoAnimation.of(true),
        effects: [
          EditorAddEffect.of({
            editor_id: new_cell.id,
            state: create_cell_state(
              new EditorInChief(transaction.state),
              new_cell
            ),
          }),
          CellOrderEffect.of({
            cell_id: new_cell.id,
            index: 0,
          }),
        ],
      };
    } else {
      return null;
    }
  });
