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
  EditorInChiefKeymap,
} from "codemirror-editor-in-chief";
import { NoAnimation, NudgeCell } from "./cell";
import { CellOrderField, CellOrderEffect } from "./cell-order.js";
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
  ])
);
