import {
  EditorSelection,
  Prec,
  SelectionRange,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { autocompletion, completionStatus } from "@codemirror/autocomplete";
import {
  CellIdOrder,
  from_cell_effects,
  nexus_extension,
  ToCellEffect,
} from "./codemirror-nexus";

// A lot of this file is an adaptation of https://github.com/fonsp/Pluto.jl/blob/ab85efca962d009c741d4ec66508d687806e9579/frontend/components/CellInput/cell_movement_plugin.js
// Only this uses my new nexus-style stuff, and it has cooler column-preserving-stuff 🤩

/**
 * Cell movement plugin!
 *
 * Two goals:
 * - Make movement and operations on the edges of cells work with their neighbors
 * - Prevent holding a button down to continue operations on neighboring cells
 *
 * I lean a lot on `view.moveByChar` and `view.moveVertically` from codemirror.
 * They will give you the position of the cursor after moving, and comparing that
 * to the current selection will tell you if the cursor would have moved normally.
 * If it would have moved normally, we don't do anything. Else, it's our time
 *
 * We use that in the keysmaps and the prevention of holding a button down.
 *
 * TODO? Maybe put delete and backspace and such here too, but these also influence
 * ..... the notebook structure, which isn't possible from independent extensions yet.
 */

/**
 * @typedef CellRelativeSelection
 * @type {SelectionRange | "begin" | "end"}
 */

/** @type {StateEffectType<{ start: CellRelativeSelection }>} */
export let MoveUpEffect = StateEffect.define({});
/** @type {StateEffectType<{ start: CellRelativeSelection }>} */
export let MoveDownEffect = StateEffect.define({});

/** @type {StateEffectType<{ start: CellRelativeSelection }>} */
let MoveFromBelowEffect = StateEffect.define({});
/** @type {StateEffectType<{ start: CellRelativeSelection }>} */
let MoveFromAboveEffect = StateEffect.define({});

// Don't-accidentally-remove-cells-plugin
// Because we need some extra info about the key, namely if it is on repeat or not,
// we can't use a keymap (keymaps don't give us the event with `repeat` property),
// so we use a custom keydown event handler.
export let prevent_holding_a_key_from_doing_things_across_cells =
  EditorView.domEventHandlers({
    keydown: (event, view) => {
      // TODO We could also require a re-press after a force focus, because
      // .... currently if you delete another cell, but keep holding down the backspace (or delete),
      // .... you'll still be deleting characters (because view.state.doc.length will be > 0)

      // Screw multicursor support on these things
      let selection = view.state.selection.main;
      // Also only cursors and not selections
      if (!selection.empty) return false;
      // Kinda the whole thing of this plugin, no?
      if (!event.repeat) return false;

      if (event.key === "Backspace") {
        if (view.state.doc.length === 0) {
          // Only if this would be a cell-deleting backspace, we jump in
          return true;
        }
      }
      if (event.key === "Delete") {
        if (view.state.doc.length === 0) {
          // Only if this would be a cell-deleting backspace, we jump in
          return true;
        }
      }

      // Because of the "hacky" way this works, we need to check if autocompletion is open...
      // else we'll block the ability to press ArrowDown for autocomplete....
      // Adopted from https://github.com/codemirror/autocomplete/blob/a53f7ff19dc3a0412f3ce6e2751b08b610e1d762/src/view.ts#L15
      // let autocompletion_open = view.state.field(completionState, false)?.open ?? false
      let autocompletion_open = false;

      // If we have a cursor instead of a multicharacter selection:
      if (event.key === "ArrowUp" && !autocompletion_open) {
        if (
          !view.moveVertically(view.state.selection.main, false).eq(selection)
        )
          return false;
        return true;
      }
      if (event.key === "ArrowDown" && !autocompletion_open) {
        if (!view.moveVertically(view.state.selection.main, true).eq(selection))
          return false;
        return true;
      }
      if (event.key === "ArrowLeft" && event.repeat) {
        if (!view.moveByChar(selection, false).eq(selection)) return false;
        return true;
      }
      if (event.key === "ArrowRight") {
        if (!view.moveByChar(selection, true).eq(selection)) return false;
        return true;
      }
    },
  });

export let cell_movement_extension = [
  Prec.highest(prevent_holding_a_key_from_doing_things_across_cells),
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
              console.log(`Can't move down`);
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
    {
      key: "ArrowLeft",
      run: (view) => {
        let selection = view.state.selection.main;
        if (!selection.empty) return false;
        if (!view.moveByChar(selection, false).eq(selection)) return false;

        view.dispatch({
          effects: [MoveUpEffect.of({ start: "end" })],
        });
        return true;
      },
    },
    {
      key: "ArrowRight",
      run: (view) => {
        let selection = view.state.selection.main;
        if (!selection.empty) return false;
        if (!view.moveByChar(selection, true).eq(selection)) return false;

        view.dispatch({
          effects: [MoveDownEffect.of({ start: "begin" })],
        });
        return true;
      },
    },
    {
      key: "PageUp",
      run: (view) => {
        view.dispatch({
          effects: [MoveUpEffect.of({ start: "begin" })],
        });
        return true;
      },
    },
    {
      key: "PageDown",
      run: (view) => {
        view.dispatch({
          effects: [MoveDownEffect.of({ start: "begin" })],
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
          let { start } = effect.value;
          console.log("Move Below from", start);

          if (start === "end") {
            view.dispatch({
              selection: EditorSelection.cursor(state.doc.length),
            });
          } else if (start === "begin") {
            view.dispatch({
              selection: EditorSelection.cursor(0),
            });
          } else if (start?.goalColumn == null) {
            view.dispatch({
              selection: EditorSelection.cursor(state.doc.length),
            });
          } else {
            console.log("Tryinna get goal column");
            let rect = view.contentDOM.getBoundingClientRect();
            console.log(`rect:`, rect);
            console.log(
              `{
                x: rect.left + (start.goalColumn ?? rect.width),
                y: rect.bottom - view.defaultLineHeight,
              }:`,
              {
                x: rect.left + (start.goalColumn ?? rect.width),
                y: rect.bottom - view.defaultLineHeight,
              }
            );
            let where = view.coordsAtPos(view.state.doc.length);
            console.log(`where:`, where);
            let new_selection = view.posAtCoords(
              {
                x: rect.left + (start.goalColumn ?? rect.width),
                y: where?.bottom ?? rect.bottom - 2 * view.defaultLineHeight,
              },
              false
            );
            console.log(`new_selection:`, new_selection);
            view.dispatch({
              selection: EditorSelection.cursor(new_selection),
            });
          }

          view.focus();
        }

        if (effect.is(MoveFromAboveEffect)) {
          let { start } = effect.value;
          if (start === "end") {
            view.dispatch({
              selection: EditorSelection.cursor(state.doc.length),
            });
          } else if (start === "begin") {
            view.dispatch({
              selection: EditorSelection.cursor(0),
            });
          } else if (start?.goalColumn == null) {
            view.dispatch({
              selection: EditorSelection.cursor(0),
            });
          } else {
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
          }

          view.focus();
        }
      }
    }
  }),
];
