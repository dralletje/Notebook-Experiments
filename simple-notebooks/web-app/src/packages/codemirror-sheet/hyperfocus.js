import { StateEffect, StateEffectType, StateField } from "@codemirror/state";
import { EditorHasSelectionField } from "codemirror-editor-in-chief";

/** @type {StateEffectType<boolean>} */
export let HyperfocusEffect = StateEffect.define();
export let HyperfocusField = StateField.define({
  create(state) {
    return false;
  },
  update(value, tr) {
    if (tr.state.field(EditorHasSelectionField) === false) {
      return false;
    }
    for (let effect of tr.effects) {
      if (effect.is(HyperfocusEffect)) {
        value = effect.value;
      }
    }
    return value;
  },
});
