import {
  Prec,
  EditorSelection,
  Facet,
  EditorState,
  TransactionSpec,
} from "@codemirror/state";
import { keymap } from "@codemirror/view";

// import { MoveToCellBelowEffect } from "./cell-movement";
import { SelectedCellsField } from "./cell-selection";
import { compact, range } from "lodash";
import {
  EditorAddEffect,
  EditorDispatchEffect,
  EditorIdFacet,
  EditorRemoveEffect,
  EditorInChiefEffect,
  EditorInChiefKeymap,
} from "../codemirror-editor-in-chief/editor-in-chief";
import { NudgeCell } from "./cell";
import { CellOrderField, CellOrderEffect } from "./cell-order.js";
import { NoAnimation } from "./last-created-cells.js";
import { syntaxTree } from "@codemirror/language";

import { create_empty_cell_facet } from "./config";

// type Formatter = ({ code, cursor }: { code: string; cursor: number }) => {
//   code: string;
//   cursor: number;
// };
// export let format_on_save_facet = Facet.define<Formatter, Formatter>({
//   combine: (values) => values[0],
// });
// let noop_format = ({ code, cursor }) => ({ code, cursor });

type SaveFunction = (state: EditorState) => TransactionSpec | null;
export let save_function_facet = Facet.define<SaveFunction, SaveFunction>({
  combine: (values) => values[0],
});

export let notebook_keymap = EditorInChiefKeymap.of([
  // {
  //   key: "Mod-s",
  //   run: ({ state, dispatch }) => {
  //     let cell_order = state.field(CellOrderField);
  //     let now = Date.now(); // Just in case map takes a lot of time ??
  //     let changed_cells = cell_order.filter((cell_id) => {
  //       let cell = state.editor(cell_id);
  //       return cell.doc.toString() !== cell.field(CellMetaField).code;
  //     });
  //     let prettified_results = changed_cells.map((cell_id) => {
  //       let cell_state = state.editor(cell_id);
  //       let code = cell_state.doc.toString();
  //       let cursor = cell_state.selection.main.head;
  //       let format = state.facet(format_on_save_facet) ?? noop_format;
  //       try {
  //         let result = format({
  //           code: code,
  //           cursor: cursor,
  //         });
  //         return {
  //           docLength: code.length,
  //           cursorOffset: result.cursor,
  //           formatted: result.code,
  //           cell_id,
  //         };
  //       } catch (error) {
  //         // TODO Nudge cell if it can't parse?
  //         return null;
  //       }
  //     });
  //     dispatch({
  //       effects: compact(prettified_results).flatMap(
  //         ({ cursorOffset, docLength, formatted, cell_id }) => [
  //           EditorDispatchEffect.of({
  //             editor_id: cell_id,
  //             transaction: {
  //               selection: EditorSelection.cursor(cursorOffset),
  //               changes: {
  //                 from: 0,
  //                 to: docLength,
  //                 insert: formatted,
  //               },
  //               effects: [
  //                 MutateCellMetaEffect.of((cell) => {
  //                   cell.code = formatted;
  //                   cell.requested_run_time = now;
  //                 }),
  //               ],
  //             },
  //           }),
  //         ]
  //       ),
  //     });
  //     return true;
  //   },
  // },
]);

export let cell_keymap = Prec.high(
  keymap.of([
    // {
    //   key: "Shift-Enter",
    //   run: ({ state, dispatch }) => {
    //     let save_function = state.facet(save_function_facet);
    //     if (save_function) {
    //       let transaction = save_function(state);
    //       if (transaction) {
    //         dispatch(transaction);
    //       }
    //       return true;
    //     }
    //     return false;
    //   },
    // },
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
                  editor_id: new_cell_id,
                  state: new_cell,
                }),
                CellOrderEffect.of({
                  cell_id: new_cell_id,
                  index: { after: cell_id },
                }),
                EditorDispatchEffect.of({
                  editor_id: new_cell_id,
                  transaction: { selection: EditorSelection.cursor(0) },
                }),
              ];
            }),
          ],
        });
        return true;
      },
    },
    // {
    //   key: "Mod-Enter",
    //   run: (view) => {
    //     let cell_id = view.state.facet(EditorIdFacet);

    //     let cell_meta = view.state.field(CellMetaField);
    //     let code = view.state.doc.toString();

    //     view.dispatch({
    //       effects: [
    //         ...(cell_meta.code !== code
    //           ? [
    //               MutateCellMetaEffect.of((cell) => {
    //                 cell.code = code;
    //                 cell.requested_run_time = Date.now();
    //               }),
    //             ]
    //           : []),
    //         EditorInChiefEffect.of((editor_in_chief) => {
    //           let create_cell_state = editor_in_chief.facet(
    //             create_empty_cell_facet
    //           );
    //           let new_cell = create_cell_state(editor_in_chief, "");
    //           let new_cell_id = new_cell.facet(EditorIdFacet);

    //           return [
    //             EditorAddEffect.of({
    //               editor_id: new_cell_id,
    //               state: new_cell,
    //             }),
    //             CellOrderEffect.of({
    //               cell_id: new_cell_id,
    //               index: { after: cell_id },
    //             }),
    //             EditorDispatchEffect.of({
    //               editor_id: new_cell_id,
    //               transaction: { selection: EditorSelection.cursor(0) },
    //             }),
    //           ];
    //         }),
    //       ],
    //     });
    //     return true;
    //   },
    // },
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
                if (cell_index === 0)
                  return EditorDispatchEffect.of({
                    editor_id: cell_id,
                    transaction: {
                      annotations: NudgeCell.of(true),
                    },
                  });

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
                  CellOrderEffect.of({
                    cell_id: cell_id,
                    index: null,
                  }),
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
