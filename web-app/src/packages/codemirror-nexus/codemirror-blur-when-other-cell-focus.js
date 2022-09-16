import {
  EditorSelection,
  SelectionRange,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { without } from "lodash";
import {
  CellIdOrder,
  from_cell_effects,
  nexus_extension,
  ToCellEffect,
} from "./codemirror-nexus";

/** @type {StateEffectType<void>} */
export let BlurEffect = StateEffect.define({});

/** @type {StateEffectType<void>} */
let DidFocusEffect = StateEffect.define({});

export let blur_when_other_cell_focus = [
  nexus_extension(
    EditorView.updateListener.of((update) => {
      let cell_order = update.state.facet(CellIdOrder);

      if (cell_order == null) {
        console.warn("Cell order is null in update listener");
        return;
      }

      for (let effect of from_cell_effects(update)) {
        let { cell_id, transaction } = effect.value;
        for (let effect of transaction.effects) {
          if (effect.is(DidFocusEffect)) {
            let other_cells = without(cell_order, cell_id);
            update.view.dispatch({
              effects: other_cells.map((cell_to_blur) =>
                ToCellEffect.of({
                  cell_id: cell_to_blur,
                  transaction_spec: {
                    effects: BlurEffect.of(),
                  },
                })
              ),
            });
          }
        }
      }
    })
  ),
  EditorView.updateListener.of(
    ({ view, state, transactions, focusChanged }) => {
      for (let transaction of transactions) {
        for (let effect of transaction.effects) {
          if (effect.is(BlurEffect)) {
            view.dispatch({
              selection: { anchor: 0, head: 0 },
            });
          }
        }
      }
    }
  ),
  EditorView.updateListener.of(
    ({ view, state, transactions, focusChanged }) => {
      if (focusChanged) {
        if (view.hasFocus) {
          view.dispatch({
            effects: [DidFocusEffect.of()],
          });
        }
      }
    }
  ),
];
