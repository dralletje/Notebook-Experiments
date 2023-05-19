import { StateEffect, StateEffectType } from "@codemirror/state";
import { invertedEffects } from "codemirror-editor-in-chief/history";
import {
  EditorAddEffect,
  EditorIdFacet,
  EditorInChiefStateField,
  EditorRemoveEffect,
} from "codemirror-editor-in-chief";
import { uniq } from "lodash";

/**
 * @typedef CellPosition
 * @type {
 *  | null
 *  | number
 *  | { after: string }
 *  | { before: string }
 * }
 */

/** @type {StateEffectType<{ index: CellPosition, cell_id: import("codemirror-editor-in-chief").EditorId }>} */
export let CellOrderEffect = StateEffect.define();

let CellOrderInvertedEffects = invertedEffects.of((transaction) => {
  let cell_order = transaction.state.field(CellOrderField.field);
  /** @type {Array<StateEffect<any>>} */
  let inverted_effects = [];
  for (let effect of transaction.effects) {
    if (effect.is(CellOrderEffect)) {
      let current_index = cell_order.indexOf(effect.value.cell_id);
      inverted_effects.push(
        CellOrderEffect.of({
          cell_id: effect.value.cell_id,
          index: current_index == -1 ? null : current_index,
        })
      );
    }

    // Just to make stuff easier, adding or removing a cell will also add or remove it from the cell order.
    if (effect.is(EditorAddEffect)) {
      // Shouldn't be necessary, but just in case check if the cell already exists
      let editor_id = effect.value.state.facet(EditorIdFacet);
      let current_index = cell_order.indexOf(editor_id);
      inverted_effects.push(
        CellOrderEffect.of({
          cell_id: editor_id,
          index: current_index == -1 ? null : current_index,
        })
      );
    }
    if (effect.is(EditorRemoveEffect)) {
      let current_index = cell_order.indexOf(effect.value.editor_id);
      if (current_index !== -1) {
        inverted_effects.push(
          CellOrderEffect.of({
            cell_id: effect.value.editor_id,
            index: current_index,
          })
        );
      }
    }
  }
  return inverted_effects;
});

export let CellOrderField = EditorInChiefStateField.define({
  create() {
    return /** @type {import("codemirror-editor-in-chief").EditorId[]} */ ([]);
  },
  update(value, transaction) {
    let current_value = value;
    for (let effect of transaction.effects) {
      if (effect.is(CellOrderEffect)) {
        let without_cell = current_value.filter(
          (cell_id) => cell_id !== effect.value.cell_id
        );
        if (effect.value.index == null) {
          current_value = without_cell;
        } else if (effect.value.index.after) {
          let index =
            without_cell.indexOf(effect.value.index.after) ??
            without_cell.length;
          current_value = [
            ...without_cell.slice(0, index + 1),
            effect.value.cell_id,
            ...without_cell.slice(index + 1),
          ];
        } else if (effect.value.index.before) {
          let index =
            without_cell.indexOf(effect.value.index.before) ??
            without_cell.length;
          current_value = [
            ...without_cell.slice(0, index),
            effect.value.cell_id,
            ...without_cell.slice(index),
          ];
        } else {
          current_value = [
            ...without_cell.slice(0, effect.value.index),
            effect.value.cell_id,
            ...without_cell.slice(effect.value.index),
          ];
        }
      }

      // Just to make stuff easier, adding or removing a cell will also add or remove it from the cell order.
      if (effect.is(EditorAddEffect)) {
        current_value = [
          ...current_value,
          effect.value.state.facet(EditorIdFacet),
        ];
      }
      if (effect.is(EditorRemoveEffect)) {
        current_value = current_value.filter(
          (cell_id) => cell_id !== effect.value.editor_id
        );
      }
    }

    let current_value_before_uniq = current_value;
    current_value = uniq(current_value);

    if (current_value_before_uniq.length !== current_value.length) {
      // prettier-ignore
      console.warn("Cell order contained duplicate cell ids, which were removed.");
    }

    return current_value;
  },
  provide: () => CellOrderInvertedEffects,
});
