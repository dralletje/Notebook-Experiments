import {
  Prec,
  EditorSelection,
  Facet,
  EditorState,
  TransactionSpec,
} from "@codemirror/state";
import { keymap } from "@codemirror/view";

// import { MoveToCellBelowEffect } from "./cell-movement";
// import { SelectedCellsField } from "./cell-selection";
import { compact, range } from "lodash";
import {
  EditorAddEffect,
  EditorDispatchEffect,
  EditorIdFacet,
  EditorRemoveEffect,
  EditorInChiefEffect,
} from "codemirror-editor-in-chief";
import { NoAnimation, NudgeCell } from "./cell";
import { CellOrderField, CellOrderEffect } from "./cell-order.js";

import { create_empty_cell_facet } from "./config";

export let split_and_stitch_cells = Prec.high(
  keymap.of([
    {
      // If we press enter while the previous two lines are empty, we want to add a new cell/split this cell
      key: "Enter",
      run: ({ state, dispatch }) => {
        if (!state.selection.main.empty) return false;
        let cursor = state.selection.main.from;

        // TODO Check if we are "outside" anything in the syntax tree
        // .... (Or allow blocks maybe? But not incomplete, nor inside strings or objects etc)

        let cell_id = state.facet(EditorIdFacet);

        let current_line = state.doc.lineAt(cursor);
        if (current_line.number === 1)
          // Can't split the from line
          return false;
        if (
          current_line.text.slice(0, cursor - current_line.from).trim() !== ""
        )
          // Can't split if there is text before the cursor
          return false;

        let previous_line = state.doc.line(current_line.number - 1);

        if (previous_line.text.trim() !== "") return false;

        dispatch({
          changes: {
            from: Math.max(previous_line.from - 1, 0),
            to: state.doc.length,
            insert: "",
          },
          annotations: NoAnimation.of(true),
          effects: [
            EditorInChiefEffect.of((editor_in_chief) => {
              let create_cell_state = editor_in_chief.facet(
                create_empty_cell_facet
              );
              let new_cell = create_cell_state(
                editor_in_chief,
                state.doc.sliceString(cursor, state.doc.length)
              );
              let new_cell_id = new_cell.facet(EditorIdFacet);
              return [
                EditorAddEffect.of({
                  state: new_cell,
                  focus: true,
                }),
                CellOrderEffect.of({
                  cell_id: new_cell_id,
                  index: { after: cell_id },
                }),
              ];
            }),
          ],
        });
        return true;
      },
    },
    {
      key: "Backspace",
      run: (view) => {
        let cell_id = view.state.facet(EditorIdFacet);
        if (!view.state.selection.main.empty) return false;

        if (view.state.selection.main.from === 0) {
          view.dispatch({
            effects: [
              EditorInChiefEffect.of((state) => {
                let cell_order = state.field(CellOrderField);
                let cell_index = cell_order.indexOf(cell_id);

                // TODO Make it possible to disallow deleting the first cell in the notebook?
                if (cell_index === 0 && view.state.doc.length === 0) {
                  let next_cell_id = cell_order[cell_index + 1];

                  return [
                    EditorRemoveEffect.of({ editor_id: cell_id }),
                    ...(next_cell_id
                      ? [
                          EditorDispatchEffect.of({
                            editor_id: next_cell_id,
                            transaction: {
                              selection: EditorSelection.cursor(0),
                            },
                          }),
                        ]
                      : []),
                  ];
                }

                let previous_cell_id = cell_order[cell_index - 1];
                let previous_cell_state = state.editor(previous_cell_id);

                // You can't merge with a cell of a different type
                // But you can remove the current cell if it is empty
                return [
                  EditorDispatchEffect.of({
                    editor_id: previous_cell_id,
                    transaction: {
                      selection: EditorSelection.cursor(
                        previous_cell_state.doc.length + 2
                      ),
                      changes: {
                        from: previous_cell_state.doc.length,
                        to: previous_cell_state.doc.length,
                        insert: "\n\n" + view.state.doc.toString(),
                      },
                    },
                  }),
                  EditorRemoveEffect.of({ editor_id: cell_id }),
                ];
              }),
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
