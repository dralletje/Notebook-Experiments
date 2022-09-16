import { mutate, readonly } from "use-immer-store";
import {
  EditorState,
  Facet,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { invertedEffects } from "./packages/codemirror-nexus/codemirror-shared-history";
import { without } from "lodash";
import { v4 as uuidv4 } from "uuid";

/** @type {StateEffectType<{ index: number, cell: import("./App").Cell }>} */
export let AddCellEffect = StateEffect.define();

/** @type {StateEffectType<{ cell_id: import("./App").CellId }>} */
export let RemoveCellEffect = StateEffect.define();

/** @type {Facet<import("./App").Notebook, import("./App").Notebook>} */
export let NotebookFacet = Facet.define({
  combine: (x) => x[0],
});

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
          cell: {
            id: uuidv4(),
            code: "",
            unsaved_code: "",
            last_run: -Infinity,
          },
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
  }
  return inverted_effects;
});

export let notebook_in_nexus = [
  add_single_cell_when_all_cells_are_removed,
  invert_removing_and_adding_cells,
  mutate_notebook_on_add_or_remove,
];
