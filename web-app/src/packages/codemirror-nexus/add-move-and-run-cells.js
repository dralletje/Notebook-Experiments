import { mutate, readonly } from "use-immer-store";
import {
  EditorState,
  Facet,
  Prec,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { without } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { invertedEffects } from "./codemirror-shared-history";

import { CellIdFacet, from_cell_effects, NexusFacet } from "./codemirror-nexus";
import { MoveUpEffect } from "./codemirror-cell-movement";

/** @type {StateEffectType<{ index: number, cell: import("../../notebook-types").Cell }>} */
export let AddCellEffect = StateEffect.define();

/** @type {StateEffectType<{ cell_id: import("../../notebook-types").CellId }>} */
export let RemoveCellEffect = StateEffect.define();

/** @type {StateEffectType<{ cell_id: import("../../notebook-types").CellId, from: number, to: number }>} */
export let MoveCellEffect = StateEffect.define();

/** @type {StateEffectType<{ cell_id: import("../../notebook-types").CellId, at: number }>} */
export let RunCellEffect = StateEffect.define();

/** @type {StateEffectType<{ cell_id: import("../../notebook-types").CellId, at: number }>} */
export let RunIfChangedCellEffect = StateEffect.define();

/** @type {Facet<import("../../notebook-types").Notebook, import("../../notebook-types").Notebook>} */
export let NotebookFacet = Facet.define({
  combine: (x) => x[0],
});

/**
 * @param {string} id
 * @returns {import("../../notebook-types").Cell}
 */
export let empty_cell = (id = uuidv4()) => {
  return {
    id: id,
    code: "",
    unsaved_code: "",
    last_run: -Infinity,
  };
};

// It's just redux, but with immer.
let mutate_notebook_on_add_or_remove = EditorView.updateListener.of(
  (update) => {
    let notebook = update.state.facet(NotebookFacet);
    for (let transaction of update.transactions) {
      for (let effect of transaction.effects) {
        if (effect.is(AddCellEffect)) {
          let { index, cell } = effect.value;
          console.log(`ADD CELL EFFECT index, cell:`, index, cell);
          mutate(notebook, (notebook) => {
            notebook.cells[cell.id] = cell;
            notebook.cell_order.splice(index, 0, cell.id);
          });
        }
        if (effect.is(RemoveCellEffect)) {
          let { cell_id } = effect.value;
          console.log(`REMOVE CELL EFFECT cell_id:`, cell_id);
          mutate(notebook, (notebook) => {
            delete notebook.cells[cell_id];
            notebook.cell_order = without(notebook.cell_order, cell_id);
          });
        }

        if (effect.is(MoveCellEffect)) {
          let { cell_id, from, to } = effect.value;
          console.log(`MOVE CELL EFFECT cell_id, from, to:`, cell_id, from, to);
          mutate(notebook, (notebook) => {
            let [cell_id_we_removed] = notebook.cell_order.splice(from, 1);
            if (cell_id_we_removed !== cell_id) {
              // prettier-ignore
              throw new Error(`cell_id_we_removed !== cell_id: ${cell_id_we_removed} !== ${cell_id}`);
            }

            notebook.cell_order.splice(to, 0, cell_id);
          });
        }

        if (effect.is(RunCellEffect)) {
          let { cell_id, at } = effect.value;
          console.log(`notebook:`, notebook);
          console.log(`cell_id:`, cell_id);
          let cell = notebook.cells[cell_id];
          mutate(cell, (cell) => {
            cell.code = cell.unsaved_code;
            cell.is_waiting = true;
            cell.last_run = at;
          });
        }

        if (effect.is(RunIfChangedCellEffect)) {
          let { cell_id, at } = effect.value;
          let cell = notebook.cells[cell_id];
          if (cell.code !== cell.unsaved_code) {
            mutate(cell, (cell) => {
              cell.code = cell.unsaved_code;
              cell.is_waiting = true;
              cell.last_run = at;
            });
          }
        }
      }
    }
  }
);

let add_single_cell_when_all_cells_are_removed =
  EditorState.transactionExtender.of((transaction) => {
    let notebook = transaction.startState.facet(NotebookFacet);
    let cells_left_after_effects = { ...notebook.cells };
    for (let effect of transaction.effects) {
      if (effect.is(AddCellEffect)) {
        cells_left_after_effects[effect.value.cell.id] = effect.value.cell;
      }
      if (effect.is(RemoveCellEffect)) {
        delete cells_left_after_effects[effect.value.cell_id];
      }
    }

    // Add a cell when the last cell is removed, but then the inverse of that
    if (Object.keys(cells_left_after_effects).length === 0) {
      return {
        effects: AddCellEffect.of({
          index: 0,
          cell: empty_cell(),
        }),
      };
    } else {
      return null;
    }
  });

let invert_removing_and_adding_cells = invertedEffects.of((transaction) => {
  let notebook = transaction.startState.facet(NotebookFacet);
  let inverted_effects = [];
  for (let effect of transaction.effects) {
    if (effect.is(AddCellEffect)) {
      inverted_effects.push(
        RemoveCellEffect.of({ cell_id: effect.value.cell.id })
      );
    }
    if (effect.is(RemoveCellEffect)) {
      let cell_id = effect.value.cell_id;
      let index = notebook.cell_order.indexOf(cell_id);
      let cell = readonly(notebook.cells[cell_id]);
      inverted_effects.push(
        AddCellEffect.of({
          index,
          cell,
        })
      );
    }
    if (effect.is(MoveCellEffect)) {
      let { cell_id, from, to } = effect.value;
      inverted_effects.push(
        MoveCellEffect.of({
          cell_id,
          from: to,
          to: from,
        })
      );
    }
  }
  return inverted_effects;
});

let notebook_keymap = keymap.of([
  {
    key: "Mod-s",
    run: ({ state, dispatch }) => {
      let notebook = state.facet(NotebookFacet);
      let now = Date.now(); // Just in case map takes a lot of time ??

      dispatch({
        effects: notebook.cell_order.map((cell_id) =>
          RunIfChangedCellEffect.of({ cell_id: cell_id, at: now })
        ),
      });
      return true;
    },
  },
]);

let update_notebook_when_cell_changes = EditorView.updateListener.of(
  (update) => {
    let notebook = update.state.facet(NotebookFacet);
    for (let {
      value: { cell_id, transaction },
    } of from_cell_effects(update)) {
      if (transaction.docChanged) {
        mutate(notebook.cells[cell_id], (cell) => {
          cell.unsaved_code = update.state.doc.toString();
        });
      }
    }
  }
);

export let notebook_in_nexus = [
  add_single_cell_when_all_cells_are_removed,
  invert_removing_and_adding_cells,
  mutate_notebook_on_add_or_remove,
  notebook_keymap,
  // update_notebook_when_cell_changes,
];

export let cell_keymap = Prec.high(
  keymap.of([
    {
      key: "Shift-Enter",
      run: (view) => {
        let nexus = view.state.facet(NexusFacet);
        let cell_id = view.state.facet(CellIdFacet);
        nexus.dispatch({
          effects: [RunCellEffect.of({ cell_id: cell_id, at: Date.now() })],
        });
        return true;
      },
    },
    {
      key: "Mod-Enter",
      run: (view) => {
        let nexus = view.state.facet(NexusFacet);
        let cell_id = view.state.facet(CellIdFacet);
        let notebook = view.state.facet(NotebookFacet);
        nexus.dispatch({
          effects: [
            RunIfChangedCellEffect.of({ cell_id: cell_id, at: Date.now() }),
            AddCellEffect.of({
              index: notebook.cell_order.indexOf(cell_id) + 1,
              cell: empty_cell(),
            }),
          ],
        });
        return true;
      },
    },
    {
      key: "Backspace",
      run: (view) => {
        let nexus = view.state.facet(NexusFacet);
        let cell_id = view.state.facet(CellIdFacet);
        if (view.state.doc.length === 0) {
          // Focus on previous cell
          view.dispatch({
            effects: [MoveUpEffect.of({ start: "end" })],
          });
          // Remove cell
          nexus.dispatch({
            effects: [RemoveCellEffect.of({ cell_id: cell_id })],
          });
          return true;
        } else {
          return false;
        }
      },
    },
  ])
);
