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
  MergeCellFromBelowEffect,
  NexusEffect,
  RemoveCellEffect,
  RunCellEffect,
  RunIfChangedCellEffect,
} from "../../NotebookEditor";
import {
  MoveToCellAboveEffect,
  MoveToCellBelowEffect,
} from "./codemirror-cell-movement";
import { format_with_prettier } from "../../format-javascript-with-prettier";
import { SelectedCellsField } from "../../cell-selection";
import { toggleComment } from "@codemirror/commands";
import { range } from "lodash";

export let notebook_keymap = keymap.of([
  {
    key: "Mod-/",
    run: ({ state, dispatch }) => {
      let notebook = state.field(CellEditorStatesField);
      let selected_cells = state.field(SelectedCellsField);

      console.log(`selected_cells:`, selected_cells);

      let cells = selected_cells.map((cell_id) => notebook.cells[cell_id]);

      let selected_code_cells = cells.filter(
        (cell) => cell.facet(CellTypeFacet) === "code"
      );

      if (selected_code_cells.length === 0) return false;

      // Go though all lines in every cell and check if they all start with `//`
      let all_lines_start_with_comment = selected_code_cells.every((cell) => {
        let lines = Array.from(cell.doc.iterLines());
        return lines.every((line) => line.startsWith("//"));
      });

      console.log(
        `all_lines_start_with_comment:`,
        all_lines_start_with_comment
      );

      if (all_lines_start_with_comment) {
        // Remove `//` from all lines in all selected cells
        dispatch({
          effects: selected_code_cells.map((cell) =>
            CellDispatchEffect.of({
              cell_id: cell.facet(CellIdFacet),
              transaction: {
                changes: range(1, cell.doc.lines + 1).map((line_number) => {
                  let line = cell.doc.line(line_number);
                  return {
                    from: line.from,
                    to: line.text.startsWith("// ")
                      ? line.from + 3
                      : line.from + 2,
                    insert: "",
                  };
                }),
              },
            })
          ),
        });
      } else {
        dispatch({
          effects: selected_code_cells.map((cell) =>
            CellDispatchEffect.of({
              cell_id: cell.facet(CellIdFacet),
              transaction: {
                changes: range(1, cell.doc.lines + 1).map((line_number) => {
                  let line = cell.doc.line(line_number);
                  return {
                    from: line.from,
                    to: line.from,
                    insert: "// ",
                  };
                }),
              },
            })
          ),
        });
      }

      return true;

      // dispatch({
      //   effects: selected_cells.flatMap(cell_id => {
      //     toggleComment
      //   })
      // })
    },
  },
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
      // If we press enter while the previous two lines are empty, we want to add a new cell/split this cell
      key: "Enter",
      run: ({ state, dispatch }) => {
        if (!state.selection.main.empty) return false;
        let cursor = state.selection.main.from;

        let cell_id = state.facet(CellIdFacet);

        // TODO Should just not apply this to text cells to begin with 🤷‍♀️ but cba
        if (state.facet(CellTypeFacet) === "text") return false;

        let current_line = state.doc.lineAt(cursor);
        if (current_line.number === 1)
          // Can't split the from line
          return false;
        let previous_line = state.doc.line(current_line.number - 1);

        if (previous_line.text.trim() !== "") return false;

        let new_cell = {
          ...empty_cell(),
          unsaved_code: state.doc.sliceString(cursor, state.doc.length),
        };

        // TODO Need two dispatches, because my Nexus can't handle a mix of NexusEffects and CellDispatchEffects in one transaction...
        // .... So need something for this! Maybe make CellEditorStatesField look for the NexusEffects directly?
        // .... Then Nexus effects can ONLY be used to modify the cell states... but what else is there?
        // .... There might be later, so maybe NexusEffect should have a sibling called BroadcastEffect,
        // .... Where a NexusEffect is actually for the nexus "completely" separate from the cell states, 🤔,
        // .... and a BroadcastEffect is for the cell states only.
        dispatch({
          changes: {
            from: Math.max(previous_line.from - 1, 0),
            to: state.doc.length,
            insert: "",
          },
          effects: [
            NexusEffect.of(
              AddCellEffect.of({
                index: { after: cell_id },
                cell: new_cell,
              })
            ),
            // MoveToCellBelowEffect.of({ start: "begin" }),
          ],
        });
        dispatch({ effects: MoveToCellBelowEffect.of({ start: "begin" }) });
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
        if (!view.state.selection.main.empty) return false;

        if (view.state.selection.main.from === 0) {
          view.dispatch({
            effects: [
              // Focus on previous cell
              NexusEffect.of(MergeCellFromBelowEffect.of({ cell_id: cell_id })),
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
