import {
  EditorSelection,
  Facet,
  Prec,
  SelectionRange,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  EditorDispatchEffect,
  EditorInChiefEffect,
  EditorExtension,
} from "codemirror-editor-in-chief";
import { CellOrderField } from "./cell-order.js";

// A lot of this file is an adaptation of https://github.com/fonsp/Pluto.jl/blob/ab85efca962d009c741d4ec66508d687806e9579/frontend/components/CellInput/cell_movement_plugin.js
// Only this uses my new nexus-style stuff, and it has cooler column-preserving-stuff 🤩

// TODO: Now I moved selection to the notebook state,
// ....  I can probably clean this up a bunch by using that.

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

/**
 * @typedef CursorDestination
 * @type {{ at: CellRelativeSelection, screenGoalColumn?: number }}
 */

/** @type {StateEffectType<CursorDestination>} */
let MoveFromCellAboveEffect = StateEffect.define({});
/** @type {StateEffectType<CursorDestination>} */
let MoveFromCellBelowEffect = StateEffect.define({});

/**
 * @param {CursorDestination} destination
 */
let move_to_cell_above = (destination) => {
  return EditorInChiefEffect.of((state, cell_id) => {
    let cell_order = state.field(CellOrderField);
    let cell_index = cell_order.indexOf(cell_id);
    if (cell_order[cell_index - 1] == null) {
      console.log(`CELL MOVEMENT: Can't move up from "${cell_id}"`);
      return null;
    }

    return EditorDispatchEffect.of({
      editor_id: cell_order[cell_index - 1],
      transaction: {
        scrollIntoView: true,
        effects: [MoveFromCellBelowEffect.of(destination)],
      },
    });
  });
};

/**
 * @param {CursorDestination} destination
 */
let move_to_cell_below = (destination) => {
  return EditorInChiefEffect.of((state, cell_id) => {
    let cell_order = state.field(CellOrderField);
    let cell_index = cell_order.indexOf(cell_id);
    if (cell_order[cell_index + 1] == null) {
      console.log(`CELL MOVEMENT: Can't move down from "${cell_id}"`);
      return [];
    }

    return EditorDispatchEffect.of({
      editor_id: cell_order[cell_index + 1],
      transaction: {
        scrollIntoView: true,
        effects: [MoveFromCellAboveEffect.of(destination)],
      },
    });
  });
};

let viewplugin_for_cell = EditorExtension.of(
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

        if (effect.is(MoveFromCellBelowEffect)) {
          let { at: start, screenGoalColumn } = effect.value;
          if (start === "end") {
            view.dispatch({
              selection: EditorSelection.cursor(state.doc.length),
            });
          } else if (start === "begin") {
            view.dispatch({
              selection: EditorSelection.cursor(0),
            });
            // } else if (screenGoalColumn != null) {
            //   let _screenGoalColumn = screenGoalColumn;
            //   // view.requestMeasure({
            //   //   read() {
            //   let rect = view.contentDOM.getBoundingClientRect();
            //   let where = view.coordsAtPos(view.state.doc.length);
            //   let new_selection = view.posAtCoords(
            //     {
            //       x: _screenGoalColumn,
            //       y: where?.bottom ?? rect.bottom - 2 * view.defaultLineHeight,
            //     },
            //     false
            //   );
            //   view.dispatch({
            //     selection: EditorSelection.cursor(
            //       new_selection,
            //       undefined,
            //       undefined,
            //       _screenGoalColumn - rect.left
            //     ),
            //   });
            //   //   },
            //   // });
          } else if (start?.goalColumn == null) {
            view.dispatch({
              selection: EditorSelection.cursor(state.doc.length),
            });
          } else {
            // Try to move to the goalColumn that came from the previous cell selection
            let rect = view.contentDOM.getBoundingClientRect();
            let where = view.coordsAtPos(view.state.doc.length);
            let new_selection = view.posAtCoords(
              {
                x: rect.left + start.goalColumn,
                y: where?.bottom ?? rect.bottom - 2 * view.defaultLineHeight,
              },
              false
            );
            view.dispatch({
              selection: EditorSelection.cursor(
                new_selection,
                undefined,
                undefined,
                start.goalColumn
              ),
            });
          }

          view.focus();
        }

        if (effect.is(MoveFromCellAboveEffect)) {
          let { at: start } = effect.value;
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
                x: rect.left + start.goalColumn,
                y: rect.top + view.defaultLineHeight,
              },
              false
            );
            view.dispatch({
              selection: EditorSelection.cursor(
                new_selection,
                undefined,
                undefined,
                start.goalColumn
              ),
            });
          }

          view.focus();
        }
      }
    }
  })
);

// Don't-accidentally-remove-cells-plugin
// Because we need some extra info about the key, namely if it is on repeat or not,
// we can't use a keymap (keymaps don't give us the event with `repeat` property),
// so we use a custom keydown event handler.
let prevent_holding_a_key_from_doing_things_across_cells =
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

/**
 * @type {import("@codemirror/view").KeyBinding[]}
 */
export let arrows_move_between_cells_keymap = [
  {
    key: "ArrowUp",
    run: (view) => {
      let selection = view.state.selection.main;
      if (!selection.empty) return false;

      // RIP wrapped first lines
      if (!view.moveVertically(selection, false).eq(selection)) return false;
      // RIP screenGoalColumn
      // if (view.state.doc.lineAt(selection.from).number !== 1) return false;
      // view.requestMeasure({
      //   read: () => {
      let rect = view.coordsAtPos(selection.from);
      let screen_goal_column = rect == null ? 0 : rect.left;
      view.dispatch({
        effects: [
          move_to_cell_above({
            at: selection,
            screenGoalColumn: screen_goal_column,
          }),
        ],
      });
      //   },
      // });
      return true;
    },
  },
  {
    key: "ArrowDown",
    run: (view) => {
      let selection = view.state.selection.main;
      if (!selection.empty) return false;
      if (!view.moveVertically(selection, true).eq(selection)) return false;
      // view.requestMeasure({
      //   read: () => {
      let rect = view.coordsAtPos(selection.from);
      let screen_goal_column = rect == null ? 0 : rect.left;
      view.dispatch({
        effects: [move_to_cell_below({ at: selection })],
      });
      //   },
      // });
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
        effects: [move_to_cell_above({ at: "end" })],
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
        effects: [move_to_cell_below({ at: "begin" })],
      });
      return true;
    },
  },
  {
    key: "PageUp",
    run: (view) => {
      view.dispatch({
        effects: [move_to_cell_above({ at: "begin" })],
      });
      return true;
    },
  },
  {
    key: "PageDown",
    run: (view) => {
      view.dispatch({
        effects: [move_to_cell_below({ at: "begin" })],
      });
      return true;
    },
  },
];

export let cell_movement_extension = [
  viewplugin_for_cell,
  // Highest because it needs to handle keydown before the keymap normally does
  EditorExtension.of(
    Prec.highest(prevent_holding_a_key_from_doing_things_across_cells)
  ),
  EditorExtension.of(Prec.high(keymap.of(arrows_move_between_cells_keymap))),
];
