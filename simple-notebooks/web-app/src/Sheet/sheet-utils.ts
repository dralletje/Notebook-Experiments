import { mapValues, range } from "lodash";
import {
  EditorDispatchEffect,
  EditorExtension,
  EditorId,
  EditorIdFacet,
  EditorInChief,
  EditorInChiefKeymap,
  EditorInChiefStateField,
} from "../packages/codemirror-editor-in-chief/editor-in-chief";
import {
  Cell,
  CellId,
  CellMetaField,
  CellTypeFacet,
  MutateCellMetaEffect,
  Notebook,
  NotebookSerialized,
} from "../packages/codemirror-notebook/cell";
import { CellOrderField } from "../packages/codemirror-notebook/cell-order.js";
import { create_codemirror_notebook } from "../packages/codemirror-notebook/codemirror-notebook";
import {
  historyKeymap,
  shared_history,
} from "../packages/codemirror-editor-in-chief/codemirror-shared-history";
import { HyperfocusField } from "../packages/codemirror-sheet/hyperfocus";
import { cell_keymap } from "../packages/codemirror-sheet/sheet-keymap";
import { EditorSelection, EditorState, StateEffect } from "@codemirror/state";

export let editorinchief_to_sheet = (
  state: EditorInChief<EditorState>
): Notebook => {
  let cell_editor_states = state.editors;
  return {
    cell_order: state.field(CellOrderField),
    cells: Object.fromEntries(
      cell_editor_states.mapValues((cell_state) => {
        let type = cell_state.facet(CellTypeFacet);
        return {
          id: cell_state.facet(EditorIdFacet),
          unsaved_code: cell_state.doc.toString(),
          ...cell_state.field(CellMetaField),
          type: type,

          // This autosaves the text cells
          // TODO? Do we want this?
          ...(type === "text" ? { code: cell_state.doc.toString() } : {}),
        };
      })
    ),
  };
};

export let sheetcell_to_editorstate = (
  editorinchief: EditorInChief<EditorState>,
  cell: any
) => {
  return editorinchief.create_section_editor({
    editor_id: cell.id as EditorId,
    doc: cell.unsaved_code ?? cell.code,
    extensions: [
      // @ts-ignore
      EditorIdFacet.of(cell.id),
      CellMetaField.init(() => ({
        code: cell.code,
        requested_run_time: 0,
        folded: false,
        type: "code",
      })),
      HyperfocusField,
      cell_keymap,
    ],
  });
};

// export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const ALPHABET = "ABCDEFGHIJKLMNOP";
type SheetSize = {
  rows: number;
  columns: number;
};
export const SheetSizeField = EditorInChiefStateField.define<SheetSize>({
  create(state) {
    return {
      rows: 30,
      columns: ALPHABET.length,
    };
  },
  update(value, tr) {
    // Nothing... yet!
    return value;
  },
});

type SelectedCell = { column: number; row: number };
class SelectedCellClass {
  column: number;
  row: number;
  size: SheetSize;
  constructor(
    { column, row }: { column: number; row: number },
    size: SheetSize
  ) {
    this.column = column;
    this.row = row;
    this.size = size;
  }

  get id() {
    return `${ALPHABET[this.column - 1]}${this.row}` as CellId;
  }
  get up() {
    if (this.row === 1) {
      return null;
    }
    return new SelectedCellClass(
      {
        column: this.column,
        row: this.row - 1,
      },
      this.size
    );
  }
  get down() {
    if (this.row === this.size.rows) {
      return null;
    }
    return new SelectedCellClass(
      {
        column: this.column,
        row: this.row + 1,
      },
      this.size
    );
  }
  get left() {
    if (this.column === 1) {
      return null;
    }
    return new SelectedCellClass(
      {
        column: this.column - 1,
        row: this.row,
      },
      this.size
    );
  }
  get right() {
    if (this.column === this.size.columns) {
      return null;
    }
    return new SelectedCellClass(
      {
        column: this.column + 1,
        row: this.row,
      },
      this.size
    );
  }
}
export const SelectedCellEffect = StateEffect.define<SelectedCell | null>();
export const SelectedCellField =
  EditorInChiefStateField.define<SelectedCellClass | null>({
    create(state) {
      return null;
    },
    update(value, tr) {
      for (let effect of tr.effects) {
        if (effect.is(SelectedCellEffect)) {
          let sheet_size = tr.state.field(SheetSizeField);
          if (
            effect.value.column < 1 ||
            sheet_size.columns < effect.value.column ||
            effect.value.row < 1 ||
            sheet_size.row < effect.value.row
          )
            continue;
          value = new SelectedCellClass(effect.value, sheet_size);
        }
      }
      return value;
    },
  });

// @ts-ignore
export let EXCEL_CELLS =
  /** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId[]} */ range(
    1,
    10
  ).flatMap((i) => ALPHABET.split("").map((j) => `${j}${i}` as EditorId));

export let sheet_to_editorinchief = (
  notebook: NotebookSerialized,
  extensions = []
) => {
  return EditorInChief.create({
    editors: (editorstate) => {
      return Object.fromEntries(
        EXCEL_CELLS.map((cell_id) => [
          cell_id,
          sheetcell_to_editorstate(editorstate, {
            id: cell_id,
            code: "",
            unsaved_code: "",
          }),
        ])
      );
    },
    extensions: [
      extensions,
      SelectedCellField,
      SheetSizeField,
      cell_movement,
      // This works so smooth omg
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
    ],
  });
};

let EMPTY_TITLE_CELL_ID = "Something-Wonderful𓃰" as CellId;
let EMPTY_CODE_CELL_ID = "So-Exciting𓆉" as CellId;

export let empty_sheet = (name: string): NotebookSerialized => {
  return {
    cell_order: [EMPTY_TITLE_CELL_ID, EMPTY_CODE_CELL_ID],
    cells: {
      [EMPTY_TITLE_CELL_ID]:
        /** @type {import("./packages/codemirror-notebook/cell").Cell} */
        {
          id: EMPTY_TITLE_CELL_ID,
          type: "text",
          unsaved_code: `# ${name}`,
          code: `# ${name}`,
          requested_run_time: 0,
          folded: false,
        },
      [EMPTY_CODE_CELL_ID]:
        /** @type {import("./packages/codemirror-notebook/cell").Cell} */
        {
          id: EMPTY_CODE_CELL_ID,
          type: "code",
          unsaved_code: "",
          code: "",
          requested_run_time: 0,
          folded: false,
        },
    },
  };
};

export let cell_movement = EditorInChiefKeymap.of([
  {
    key: "Enter",
    run: ({ state, dispatch }) => {
      let cell_id = state.field(SelectedCellField)?.id;
      console.log(`cell_id:`, cell_id);
      if (!cell_id) return false;

      let cell_state = state.editor(cell_id);
      dispatch({
        effects: [
          EditorDispatchEffect.of({
            editor_id: cell_id,
            transaction: {
              selection: EditorSelection.create([
                EditorSelection.cursor(cell_state.doc.length),
              ]),
            },
          }),
        ],
      });
      return true;
    },
  },
  {
    key: "Backspace",
    run: ({ state, dispatch }) => {
      let cell_id = state.field(SelectedCellField)?.id;
      if (!cell_id) return false;

      let cell_state = state.editor(cell_id);
      dispatch({
        effects: [
          EditorDispatchEffect.of({
            editor_id: cell_id,
            transaction: {
              changes: {
                from: 0,
                to: cell_state.doc.length,
                insert: "",
              },
              effects: [
                MutateCellMetaEffect.of((cell) => {
                  cell.code = "";
                  cell.requested_run_time = Date.now();
                }),
              ],
            },
          }),
        ],
      });
      return true;
    },
  },
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
          if (state.editor(selected.id, false)?.doc?.length === 0) break;
        }
        selected = selected.down;
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
          if (state.editor(selected.id, false)?.doc?.length === 0) break;
        }
        selected = selected.up;
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
          if (state.editor(selected.id, false)?.doc?.length === 0) break;
        }
        selected = selected.right;
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
          if (state.editor(selected.id, false)?.doc?.length === 0) break;
        }
        selected = selected.left;
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
