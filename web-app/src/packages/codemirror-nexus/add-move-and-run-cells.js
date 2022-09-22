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

// import { MoveUpEffect } from "./codemirror-cell-movement";
import {
  AddCellEffect,
  CellIdFacet,
  ForNexusEffect,
  MoveCellEffect,
  NexusFacet,
  NotebookFacet,
  RemoveCellEffect,
  RunCellEffect,
  RunIfChangedCellEffect,
} from "../../NotebookEditor";

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

      console.log("AWESOME");

      dispatch({
        effects: notebook.cell_order.map((cell_id) =>
          RunIfChangedCellEffect.of({ cell_id: cell_id, at: now })
        ),
      });
      return true;
    },
  },
]);

export let notebook_in_nexus = [
  add_single_cell_when_all_cells_are_removed,
  invert_removing_and_adding_cells,
  notebook_keymap,
  // update_notebook_when_cell_changes,
];

export let cell_keymap = Prec.high(
  keymap.of([
    {
      key: "Shift-Enter",
      run: (view) => {
        let cell_id = view.state.facet(CellIdFacet);
        console.log("#1");
        view.dispatch({
          effects: [
            ForNexusEffect.of(
              RunCellEffect.of({ cell_id: cell_id, at: Date.now() })
            ),
          ],
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
          // view.dispatch({
          //   effects: [MoveUpEffect.of({ start: "end" })],
          // });
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
