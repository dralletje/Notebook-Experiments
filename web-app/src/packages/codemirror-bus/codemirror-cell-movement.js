import {
  EditorSelection,
  SelectionRange,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  CellIdOrder,
  from_cell_effects,
  nexus_extension,
  ToCellEffect,
} from "./codemirror-nexus";

/** @type {StateEffectType<{ start: SelectionRange | null }>} */
export let MoveUpEffect = StateEffect.define({});
/** @type {StateEffectType<{ start: SelectionRange | null }>} */
export let MoveDownEffect = StateEffect.define({});

/** @type {StateEffectType<{ start: SelectionRange | null }>} */
let MoveFromBelowEffect = StateEffect.define({});
/** @type {StateEffectType<{ start: SelectionRange | null }>} */
let MoveFromAboveEffect = StateEffect.define({});

export let cell_movement_extension = [
  nexus_extension(
    EditorView.updateListener.of((update) => {
      let cell_order = update.state.facet(CellIdOrder);

      if (cell_order == null) {
        console.warn("Cell order is null in update listener");
        return;
      }

      for (let effect of from_cell_effects(update)) {
        let { cell_id, transaction } = effect.value;
        let cell_index = cell_order.indexOf(cell_id);

        for (let effect of transaction.effects) {
          if (effect.is(MoveUpEffect)) {
            console.log(`cell_order:`, cell_order);
            console.log(`cell_index - 1:`, cell_index - 1);
            if (cell_order[cell_index - 1] == null) {
              console.log(`Can't move up`);
              return;
            }

            update.view.dispatch({
              effects: [
                ToCellEffect.of({
                  cell_id: cell_order[cell_index - 1],
                  transaction_spec: {
                    effects: MoveFromBelowEffect.of(effect.value),
                  },
                }),
              ],
            });
          }
          if (effect.is(MoveDownEffect)) {
            if (cell_order[cell_index + 1] == null) {
              console.log(`Can't move up`);
              return;
            }

            update.view.dispatch({
              effects: [
                ToCellEffect.of({
                  cell_id: cell_order[cell_index + 1],
                  transaction_spec: {
                    effects: MoveFromAboveEffect.of(effect.value),
                  },
                }),
              ],
            });
          }
        }
      }
    })
  ),
  keymap.of([
    {
      key: "ArrowUp",
      run: (view) => {
        let selection = view.state.selection.main;
        if (!selection.empty) return false;
        if (!view.moveVertically(selection, false).eq(selection)) return false;

        view.dispatch({
          effects: [MoveUpEffect.of({ start: selection })],
        });
        return true;
      },
    },
    {
      key: "ArrowDown",
      run: (view) => {
        let selection = view.state.selection.main;
        if (!selection.empty) return false;
        if (!view.moveVertically(selection, true).eq(selection)) return false;
        view.dispatch({
          effects: [MoveDownEffect.of({ start: selection })],
        });
        return true;
      },
    },
  ]),
  EditorView.updateListener.of(({ view, state, transactions }) => {
    for (let transaction of transactions) {
      for (let effect of transaction.effects) {
        // A poor mans recreation of https://github.com/codemirror/view/blob/e3c298c5477e4581dc9c4514a5cc13c3b9a27e8a/src/cursor.ts#L281
        // Ideally I'd do something like
        // ```
        // let new_selection = update.view.moveVertically(
        //   update.view.moveVertically(selection_range, false),
        //   true
        // );
        // ```
        // If it wasn't for the fact that this doesn't work if you have only one line in a cell.
        // Eventually I should copy a modified version of moveVertically into here, but for now this will do.

        if (effect.is(MoveFromBelowEffect)) {
          console.log("Move Below from");

          let { start } = effect.value;
          if (start?.goalColumn == null) {
            console.log("Dispatching???");
            view.dispatch({
              selection: EditorSelection.cursor(state.doc.length),
            });
            view.focus();
            return;
          }

          let rect = view.contentDOM.getBoundingClientRect();
          let new_selection = view.posAtCoords(
            {
              x: rect.left + (start.goalColumn ?? rect.width),
              y: rect.bottom - view.defaultLineHeight,
            },
            false
          );
          view.dispatch({
            selection: EditorSelection.cursor(new_selection),
          });
          view.focus();
        }

        if (effect.is(MoveFromAboveEffect)) {
          let { start } = effect.value;
          if (start?.goalColumn == null) {
            view.dispatch({
              selection: EditorSelection.cursor(0),
            });
            view.focus();
            return;
          }

          let rect = view.contentDOM.getBoundingClientRect();
          let new_selection = view.posAtCoords(
            {
              x: rect.left + (start.goalColumn ?? rect.width),
              y: rect.top + view.defaultLineHeight,
            },
            false
          );
          view.dispatch({
            selection: EditorSelection.cursor(new_selection),
          });
          view.focus();
        }
      }
    }
  }),
];
