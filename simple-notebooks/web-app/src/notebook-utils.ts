import { mapValues } from "lodash";
import {
  EditorIdFacet,
  EditorInChief,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
  NotebookFilename,
  NotebookId,
} from "./packages/codemirror-notebook/cell";
import { CellOrderField } from "./packages/codemirror-notebook/cell-order.js";

export let notebook_state_to_notebook_serialized = (state: EditorInChief) => {
  let cell_editor_states = state.editors;
  return /** @type {import("./packages/codemirror-notebook/cell").Notebook} */ {
    id: state.facet(NotebookId),
    filename: state.facet(NotebookFilename),
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
