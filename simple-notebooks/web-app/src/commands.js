import { create_cell_state } from "./App.jsx";
import {
  EditorAddEffect,
  EditorDispatchEffect,
  EditorRemoveEffect,
} from "./packages/codemirror-editor-in-chief/logic";
import {
  CellOrderEffect,
  CellOrderField,
} from "./packages/codemirror-notebook/cell-order";
import {
  MutateCellMetaEffect,
  empty_cell,
} from "./packages/codemirror-notebook/cell";

export let actions = {
  add_text_above: {
    title: "Add Text Cell Above",
    run: ({ editor_in_chief, cell_id }) => {
      let cell_order = editor_in_chief.state.field(CellOrderField);
      let my_index = cell_order.indexOf(cell_id);
      let new_cell = empty_cell("text");
      editor_in_chief.dispatch({
        effects: [
          EditorAddEffect.of({
            editor_id: new_cell.id,
            state: create_cell_state(editor_in_chief.state, new_cell),
          }),
          CellOrderEffect.of({
            cell_id: new_cell.id,
            index: my_index,
          }),
          EditorDispatchEffect.of({
            editor_id: new_cell.id,
            transaction: { selection: { anchor: 0 } },
          }),
        ],
      });
    },
  },
  add_code_below: {
    title: "Add Code Cell Below",
    run: ({ editor_in_chief, cell_id }) => {
      let cell_order = editor_in_chief.state.field(CellOrderField);
      let my_index = cell_order.indexOf(cell_id);
      let new_cell = empty_cell();
      editor_in_chief.dispatch({
        effects: [
          EditorAddEffect.of({
            editor_id: new_cell.id,
            state: create_cell_state(editor_in_chief.state, new_cell),
          }),
          CellOrderEffect.of({
            cell_id: new_cell.id,
            index: my_index + 1,
          }),
          EditorDispatchEffect.of({
            editor_id: new_cell.id,
            transaction: { selection: { anchor: 0 } },
          }),
        ],
      });
    },
  },
  delete_cell: {
    title: "Delete cell",
    onClick: ({ editor_in_chief, cell_id }) => {
      editor_in_chief.dispatch({
        effects: [
          CellOrderEffect.of({
            index: null,
            cell_id: cell_id,
          }),
          EditorRemoveEffect.of({ editor_id: cell_id }),
        ],
      });
    },
  },
  fold_cell: {
    title: "Fold cell",
    run: ({ editor_in_chief, cell_id }) => {
      editor_in_chief.dispatch({
        effects: EditorDispatchEffect.of({
          editor_id: cell_id,
          transaction: {
            effects: MutateCellMetaEffect.of((cell) => {
              cell.folded = !cell.folded;
            }),
          },
        }),
      });
    },
  },
};
