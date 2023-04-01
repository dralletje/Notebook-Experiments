import { StateEffect, StateEffectType } from "@codemirror/state";
import { invertedEffects } from "../codemirror-editor-in-chief/codemirror-shared-history";
import { EditorInChiefStateField } from "../codemirror-editor-in-chief/editor-in-chief";

/**
 * @typedef CellPosition
 * @type {
 *  | null
 *  | number
 *  | { after: string }
 *  | { before: string }
 * }
 */

/** @type {StateEffectType<{ index: CellPosition, cell_id: import("../codemirror-editor-in-chief/editor-in-chief").EditorId }>} */
export let CellOrderEffect = StateEffect.define();

let CellOrderInvertedEffects = invertedEffects.of((transaction) => {
  let cell_order = transaction.startState.field(CellOrderField.field);
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
  }
  return inverted_effects;
});

export let CellOrderField = EditorInChiefStateField.define({
  create() {
    return /** @type {import("../codemirror-editor-in-chief/editor-in-chief").EditorId[]} */ ([]);
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
    }
    return current_value;
  },
  provide: () => CellOrderInvertedEffects,
});
