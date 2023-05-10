import { Prec } from "@codemirror/state";
import { EditorInChiefKeymap } from "../codemirror-editor-in-chief/editor-in-chief";
import { SelectedCellEffect, SelectedCellField } from "./sheet-selected-cell";

export let sheet_movement = EditorInChiefKeymap.of([
  {
    key: "ArrowUp",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);
      dispatch({
        effects: [SelectedCellEffect.of(selected.up)],
      });
      return true;
    },
  },
  {
    key: "ArrowDown",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);
      dispatch({
        effects: [SelectedCellEffect.of(selected.down)],
      });
      return true;
    },
  },
  {
    key: "ArrowLeft",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);
      dispatch({
        effects: [SelectedCellEffect.of(selected.left)],
      });
      return true;
    },
  },
  {
    key: "ArrowRight",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);
      dispatch({
        effects: [SelectedCellEffect.of(selected.right)],
      });
      return true;
    },
  },

  {
    key: "Mod-ArrowUp",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);

      if (
        state.editor(selected.id, false)?.doc?.length > 0 &&
        selected.up != null &&
        state.editor(selected.up.id, false)?.doc?.length > 0
      ) {
        // Find first cell in this column that has empty code
        // and then stop before that
        while (selected.up != null) {
          selected = selected.up;
          if (!state.editor(selected.id, false)?.doc?.length) {
            selected = selected.down;
            break;
          }
        }
      } else {
        // Find first cell in this column that has a non-empty code
        while (selected.up != null) {
          selected = selected.up;
          if (state.editor(selected.id, false)?.doc?.length > 0) break;
        }
      }

      dispatch({
        effects: [SelectedCellEffect.of(selected)],
      });
      return true;
    },
  },
  {
    key: "Mod-ArrowDown",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);

      if (
        state.editor(selected.id, false)?.doc?.length > 0 &&
        selected.down != null &&
        state.editor(selected.down.id, false)?.doc?.length > 0
      ) {
        // Find first cell in this column that has empty code
        // and then stop before that
        while (selected.down != null) {
          selected = selected.down;
          if (!state.editor(selected.id, false)?.doc?.length) {
            selected = selected.up;
            break;
          }
        }
      } else {
        // Find first cell in this column that has a non-empty code
        while (selected.down != null) {
          selected = selected.down;
          if (state.editor(selected.id, false)?.doc?.length > 0) break;
        }
      }

      dispatch({
        effects: [SelectedCellEffect.of(selected)],
      });
      return true;
    },
  },
  {
    key: "Mod-ArrowLeft",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);

      if (
        state.editor(selected.id, false)?.doc?.length > 0 &&
        selected.left != null &&
        state.editor(selected.left.id, false)?.doc?.length > 0
      ) {
        // Find first cell in this row that has empty code
        // and then stop before that
        while (selected.left != null) {
          selected = selected.left;
          if (!state.editor(selected.id, false)?.doc?.length) {
            selected = selected.right;
            break;
          }
        }
      } else {
        // Find first cell in this row that has a non-empty code
        while (selected.left != null) {
          selected = selected.left;
          if (state.editor(selected.id, false)?.doc?.length > 0) break;
        }
      }

      dispatch({
        effects: [SelectedCellEffect.of(selected)],
      });
      return true;
    },
  },
  {
    key: "Mod-ArrowRight",
    run: ({ state, dispatch }) => {
      let selected = state.field(SelectedCellField);

      if (
        state.editor(selected.id, false)?.doc?.length > 0 &&
        selected.right != null &&
        state.editor(selected.right.id, false)?.doc?.length > 0
      ) {
        // Find first cell in this row that has empty code
        // and then stop before that
        while (selected.right != null) {
          selected = selected.right;
          if (!state.editor(selected.id, false)?.doc?.length) {
            selected = selected.left;
            break;
          }
        }
      } else {
        // Find first cell in this row that has a non-empty code
        while (selected.right != null) {
          selected = selected.right;
          if (state.editor(selected.id, false)?.doc?.length > 0) break;
        }
      }

      dispatch({
        effects: [SelectedCellEffect.of(selected)],
      });
      return true;
    },
  },
]);
