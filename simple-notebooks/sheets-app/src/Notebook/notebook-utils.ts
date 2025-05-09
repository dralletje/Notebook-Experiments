import { mapValues } from "lodash";
import {
  EditorIdFacet,
  EditorInChief,
  EditorInChiefKeymap,
} from "codemirror-editor-in-chief";
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
} from "codemirror-editor-in-chief/history";
import { EditorState } from "@codemirror/state";

export let editorinchief_to_notebook = (
  state: EditorInChief<{ [key: string]: EditorState }>
): Notebook => {
  return {
    cell_order: state.field(CellOrderField),
    cells: Object.fromEntries(
      state.field(CellOrderField).map((cell_id) => {
        let cell_state = state.editor(cell_id);
        let type = cell_state.facet(CellTypeFacet);
        return [
          cell_id,
          {
            id: cell_state.facet(EditorIdFacet),
            unsaved_code: cell_state.doc.toString(),
            ...cell_state.field(CellMetaField),
            type: type,

            // This autosaves the text cells
            // TODO? Do we want this?
            ...(type === "text" ? { code: cell_state.doc.toString() } : {}),
          },
        ];
      })
    ),
  };
};

export let create_cell_state = (
  editor_in_chief: EditorInChief<{ [key: string]: EditorState }>,
  cell: Cell
) => {
  return EditorState.create({
    doc: cell.unsaved_code ?? cell.code,
    extensions: [
      editor_in_chief.section_editor_extensions(cell.id),
      CellMetaField.init(() => ({
        code: cell.code,
        requested_run_time: cell.requested_run_time ?? 0,
        folded: cell.folded,
        type: cell.type,
      })),
    ],
  });
};

export let notebook_to_editorinchief = (
  notebook: NotebookSerialized,
  extensions = []
) => {
  return EditorInChief.create({
    editors: (editorstate) => {
      return mapValues(notebook.cells, (cell) =>
        create_cell_state(editorstate, cell)
      );
    },
    extensions: [
      extensions,
      create_codemirror_notebook(notebook),
      // This works so smooth omg
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
    ],
  });
};

let EMPTY_TITLE_CELL_ID = "Something-Wonderful𓃰" as CellId;
let EMPTY_CODE_CELL_ID = "So-Exciting𓆉" as CellId;

export let empty_notebook = (name: string): NotebookSerialized => {
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
