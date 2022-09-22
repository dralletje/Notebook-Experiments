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

import {
  AddCellEffect,
  CellEditorStatesField,
  CellIdFacet,
  empty_cell,
  NexusEffect,
  RemoveCellEffect,
  RunCellEffect,
  RunIfChangedCellEffect,
} from "../../NotebookEditor";
import { MoveToCellAboveEffect } from "./codemirror-cell-movement";

export let notebook_keymap = keymap.of([
  {
    key: "Mod-s",
    run: ({ state, dispatch }) => {
      let notebook = state.field(CellEditorStatesField);
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

export let cell_keymap = Prec.high(
  keymap.of([
    {
      key: "Shift-Enter",
      run: (view) => {
        let cell_id = view.state.facet(CellIdFacet);
        view.dispatch({
          effects: [
            NexusEffect.of(
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
        let cell_id = view.state.facet(CellIdFacet);
        let notebook = view.state.field(CellEditorStatesField);
        view.dispatch({
          effects: [
            NexusEffect.of(
              RunIfChangedCellEffect.of({ cell_id: cell_id, at: Date.now() })
            ),
            NexusEffect.of(
              AddCellEffect.of({
                index: notebook.cell_order.indexOf(cell_id) + 1,
                cell: empty_cell(),
              })
            ),
          ],
        });
        return true;
      },
    },
    {
      key: "Backspace",
      run: (view) => {
        let cell_id = view.state.facet(CellIdFacet);
        if (view.state.doc.length === 0) {
          view.dispatch({
            effects: [
              // Remove cell
              NexusEffect.of(RemoveCellEffect.of({ cell_id: cell_id })),
              // Focus on previous cell
              MoveToCellAboveEffect.of({ start: "end" }),
            ],
          });
          return true;
        } else {
          return false;
        }
      },
    },
  ])
);
