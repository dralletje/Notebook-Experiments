import { EditorState, Extension } from "@codemirror/state";
import {
  EditorAddEffect,
  EditorIdFacet,
  EditorInChief,
  EditorRemoveEffect,
} from "codemirror-editor-in-chief";
import { CellOrderField, CellOrderEffect } from "./cell-order";
import { create_empty_cell_facet } from "./config";
import { NoAnimation } from "./cell";

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

      if (effect.is(EditorAddEffect)) {
        cells_left_after_effects.add(effect.value.state.facet(EditorIdFacet));
      }
      if (effect.is(EditorRemoveEffect)) {
        cells_left_after_effects.delete(effect.value.editor_id);
      }
    }

    // Add a cell when the last cell is removed
    if (cells_left_after_effects.size === 0) {
      let editor_in_chief = new EditorInChief<{ [k: string]: EditorState }>(
        transaction.state
      );
      let create_empty_cell = editor_in_chief.facet(create_empty_cell_facet);
      let new_cell = create_empty_cell(editor_in_chief, "");
      return {
        annotations: NoAnimation.of(true),
        effects: [
          EditorAddEffect.of({
            state: new_cell,
            focus: true,
          }),
        ],
      };
    } else {
      return null;
    }
  });
