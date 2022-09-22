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
  CellEditorStatesField,
  CellIdFacet,
  empty_cell,
  ForNexusEffect,
  RemoveCellEffect,
  RunCellEffect,
  RunIfChangedCellEffect,
} from "../../NotebookEditor";

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
        let cell_id = view.state.facet(CellIdFacet);
        let notebook = view.state.field(CellEditorStatesField);
        view.dispatch({
          effects: [
            ForNexusEffect.of(
              RunIfChangedCellEffect.of({ cell_id: cell_id, at: Date.now() })
            ),
            ForNexusEffect.of(
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
          // Focus on previous cell
          // view.dispatch({
          //   effects: [MoveUpEffect.of({ start: "end" })],
          // });
          // Remove cell
          view.dispatch({
            effects: [
              ForNexusEffect.of(RemoveCellEffect.of({ cell_id: cell_id })),
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
