import { EditorState, Extension } from "@codemirror/state";
import {
  EditorAddEffect,
  EditorIdFacet,
  EditorInChief,
} from "../codemirror-editor-in-chief/editor-in-chief";
import { CellOrderField, CellOrderEffect } from "./cell-order";
import { NoAnimation } from "./last-created-cells";
import { create_empty_cell_facet } from "./config";

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
      let editor_in_chief = new EditorInChief(transaction.state);
      let create_empty_cell = editor_in_chief.facet(create_empty_cell_facet);
      let new_cell = create_empty_cell(editor_in_chief, "");
      let new_cell_id = new_cell.facet(EditorIdFacet);
      return {
        annotations: NoAnimation.of(true),
        effects: [
          EditorAddEffect.of({
            editor_id: new_cell_id,
            state: new_cell,
          }),
          CellOrderEffect.of({
            cell_id: new_cell_id,
            index: 0,
          }),
        ],
      };
    } else {
      return null;
    }
  });
