import { Prec, EditorSelection } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  BlurEditorInChiefEffect,
  EditorInChiefEffect,
  EditorInChiefKeymap,
} from "../codemirror-editor-in-chief/editor-in-chief";
import { MutateCellMetaEffect } from "../codemirror-notebook/cell";
import { SelectedCellEffect, SelectedCellField } from "../../Sheet/sheet-utils";

let save_and_run = (state) => {
  return [
    MutateCellMetaEffect.of((cell) => {
      cell.code = state.doc.toString();
      cell.requested_run_time = Date.now();
    }),
    EditorInChiefEffect.of((editor_in_chief) => {
      return BlurEditorInChiefEffect.of();
    }),
  ];
};

export let cell_keymap = [
  Prec.high(
    keymap.of([
      {
        // Shift enter saves the cell and focusses on the cell above
        key: "Shift-Enter",
        run: ({ state, dispatch }) => {
          dispatch({
            effects: [
              ...save_and_run(state),
              EditorInChiefEffect.of((state) => {
                let { column, row } = state.field(SelectedCellField);
                return SelectedCellEffect.of({ column: column, row: row - 1 });
              }),
            ],
          });
          return true;
        },
      },
      {
        // Enter saves the cell and focusses on the cell to the bototm
        key: "Enter",
        run: ({ state, dispatch }) => {
          dispatch({
            effects: [
              ...save_and_run(state),
              EditorInChiefEffect.of((state) => {
                let { column, row } = state.field(SelectedCellField);
                return SelectedCellEffect.of({ column: column, row: row + 1 });
              }),
            ],
          });
          return true;
        },
      },
      {
        // Mod-enter actually adds a newline to the cell
        key: "Mod-Enter",
        run: (view) => {
          view.dispatch({
            changes: {
              from: view.state.selection.main.from,
              insert: "\n",
              to: view.state.selection.main.from,
            },
          });
          return true;
        },
      },
    ])
  ),
  EditorView.domEventHandlers({
    blur: (event, view) => {
      view.dispatch({
        effects: [...save_and_run(view.state)],
      });
    },
  }),
];
