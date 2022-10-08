import { Prec, EditorSelection } from "@codemirror/state";
import { keymap } from "@codemirror/view";

import {
  AddCellEffect,
  CellDispatchEffect,
  CellEditorStatesField,
  CellIdFacet,
  CellMetaField,
  CellTypeFacet,
  empty_cell,
  NexusEffect,
  RemoveCellEffect,
  RunCellEffect,
  RunIfChangedCellEffect,
} from "../../NotebookEditor";
import { MoveToCellAboveEffect } from "./codemirror-cell-movement";
import { format_with_prettier } from "../../format-javascript-with-prettier";

export let notebook_keymap = keymap.of([
  {
    key: "Mod-s",
    run: ({ state, dispatch }) => {
      let notebook = state.field(CellEditorStatesField);
      let now = Date.now(); // Just in case map takes a lot of time ??

      console.log("AWESOME");

      let changed_cells = notebook.cell_order.filter((cell_id) => {
        let cell = notebook.cells[cell_id];
        if (cell.facet(CellTypeFacet) === "text") return false;

        return cell.doc.toString() !== cell.field(CellMetaField).code;
      });

      let prettified_results = changed_cells.map((cell_id) => {
        let cell_state = notebook.cells[cell_id];
        try {
          let { cursorOffset, formatted } = format_with_prettier({
            code: cell_state.doc.toString(),
            cursor: cell_state.selection.main.head,
          });
          let trimmed = formatted.trim();
          return {
            docLength: cell_state.doc.length,
            cursorOffset: Math.min(cursorOffset, trimmed.length),
            formatted: trimmed,
            cell_id,
          };
        } catch (error) {
          return {
            docLength: cell_state.doc.length,
            cursorOffset: cell_state.selection.main.head,
            formatted: cell_state.doc.toString(),
            cell_id,
          };
        }
      });

      dispatch({
        effects: prettified_results.flatMap(
          ({ cursorOffset, docLength, formatted, cell_id }) => [
            CellDispatchEffect.of({
              cell_id,
              transaction: {
                selection: EditorSelection.cursor(cursorOffset),
                changes: {
                  from: 0,
                  to: docLength,
                  insert: formatted,
                },
              },
            }),
            RunCellEffect.of({ cell_id: cell_id, at: now }),
          ]
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

        // TODO Should just not apply this to text cells to begin with 🤷‍♀️ but cba
        if (view.state.facet(CellTypeFacet) === "text") return false;

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
        view.dispatch({
          effects: [
            NexusEffect.of(
              RunIfChangedCellEffect.of({ cell_id: cell_id, at: Date.now() })
            ),
            NexusEffect.of(
              AddCellEffect.of({
                index: { after: cell_id },
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
