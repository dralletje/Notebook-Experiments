import { mapValues, range } from "lodash";
import {
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
import { EditorState, StateEffect } from "@codemirror/state";

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
export const SheetSizeField = EditorInChiefStateField.define<{
  rows: number;
  columns: number;
}>({
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
export const SelectedCellEffect = StateEffect.define<SelectedCell | null>();
export const SelectedCellField =
  EditorInChiefStateField.define<SelectedCell | null>({
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
          value = effect.value;
        }
      }
      console.log(`value:`, value);
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
