import React from "react";
import { produce } from "immer";
import { isEmpty, mapValues, throttle } from "lodash";
import styled from "styled-components";
import {
  CellMetaField,
  CellTypeFacet,
} from "./packages/codemirror-notebook/cell";
import {
  SelectedCellsField,
  selected_cells_keymap,
} from "./packages/codemirror-notebook/cell-selection";
import { EditorView, keymap } from "@codemirror/view";
import {
  shared_history,
  historyKeymap,
} from "./packages/codemirror-editor-in-chief/codemirror-shared-history";
import {
  CellIdOrder,
  cell_movement_extension,
} from "./packages/codemirror-notebook/cell-movement";
import { NotebookView } from "./Notebook";
import {
  NotebookFilename,
  NotebookId,
} from "./packages/codemirror-notebook/cell";
// import { typescript_extension } from "./packages/typescript-server-webworker/codemirror-typescript.js";
import {
  EditorInChief,
  EditorExtension,
  create_nested_editor_state,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import { CellOrderField } from "./packages/codemirror-notebook/cell-order.js";
import {
  cell_keymap,
  notebook_keymap,
} from "./packages/codemirror-notebook/add-move-and-run-cells.js";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";
import { add_single_cell_when_all_cells_are_removed } from "./packages/codemirror-notebook/add-cell-when-last-is-removed";
import { useSocket } from "./use/use-socket.js";

import "./App.css";
import { ScopedStorage, useScopedStorage } from "./use/scoped-storage.js";
import { notebook_state_to_notebook_serialized } from "./notebook-utils";
import { DEFAULT_WORKSPACE } from "./yuck/DEFAULT_WORKSPACE";

/**
 * @typedef WorkspaceSerialized
 * @property {string} id
 * @property {{
 *  [filename: string]: {
 *    filename: string,
 *    notebook: import("./packages/codemirror-notebook/cell").NotebookSerialized,
 *  }
 * }} files
 */

/**
 * @typedef Workspace
 * @property {string} id
 * @property {{
 *  [filename: string]: {
 *    filename: string,
 *    state: EditorInChief,
 *  }
 * }} files
 */

let cell_id_order_from_notebook_facet = CellIdOrder.compute(
  [CellOrderField.field],
  (state) => state.field(CellOrderField.field)
);

/**
 * @param {EditorInChief} editorstate
 * @param {import("./packages/codemirror-notebook/cell").Cell} cell
 */
export let create_cell_state = (editorstate, cell) => {
  return create_nested_editor_state({
    parent: editorstate.editorstate,
    editor_id: cell.id,
    doc: cell.unsaved_code ?? cell.code,
    extensions: [
      CellMetaField.init(() => ({
        code: cell.code,
        is_waiting: cell.is_waiting,
        requested_run_time: cell.requested_run_time ?? 0,
        folded: cell.folded,
        type: cell.type,
      })),
    ],
  });
};

/** @param {{ filename: string, notebook: import("./packages/codemirror-notebook/cell").NotebookSerialized}} notebook */
let notebook_to_state = ({ filename, notebook }) => {
  return EditorInChief.create({
    editors: (editorstate) => {
      return mapValues(notebook.cells, (cell) =>
        create_cell_state(editorstate, cell)
      );
    },
    extensions: [
      CellOrderField.init(() => notebook.cell_order),
      EditorExtension.of(
        CellTypeFacet.compute(
          [CellMetaField],
          (state) => state.field(CellMetaField).type
        )
      ),

      cell_id_order_from_notebook_facet,
      cell_movement_extension,

      SelectedCellsField,
      selected_cells_keymap,
      LastCreatedCells,
      add_single_cell_when_all_cells_are_removed,

      EditorExtension.of(cell_keymap),
      notebook_keymap,

      NotebookId.of(notebook.id),
      NotebookFilename.of(filename),

      EditorExtension.of(
        EditorView.scrollMargins.of(() => ({ top: 200, bottom: 100 }))
      ),

      // This works so smooth omg
      [shared_history(), keymap.of(historyKeymap)],

      // typescript_extension((state) => {
      //   let notebook = state.field(CellEditorsField);

      //   let code = "";
      //   let cursor = 0;
      //   /** @type {{ [cell_id: string]: { start: number, end: number } }} */
      //   let cell_map = {};

      //   let type_references = `
      //   /// <reference lib="es5" />
      //   /// <reference lib="es2015" />
      //   /// <reference lib="es2015.collection" />
      //   /// <reference lib="es2015.core" />
      //   /// <reference types="node" />
      //   `;
      //   code += type_references;
      //   cursor += type_references.length;

      //   for (let cell_id of notebook.cell_order) {
      //     let cell_state = notebook.cells[cell_id];
      //     let cell = cell_state.field(CellMetaField);
      //     let unsaved_code = cell_state.doc.toString();

      //     // Using unsaved code because I want typescript to be very optimistic
      //     let code_to_add = unsaved_code;
      //     cell_map[cell_id] = {
      //       start: cursor,
      //       end: cursor + code_to_add.length,
      //     };
      //     code += code_to_add + "\n";
      //     cursor += code_to_add.length + 1;
      //   }

      //   return { code, cell_map };
      // }),
    ],
  });
};

let serialized_workspace_to_workspace = (serialized) => {
  console.log(`serialized.id:`, serialized.id);
  return /** @type {Workspace} */ ({
    id: serialized.id,
    files: mapValues(serialized.files, (file) => {
      return {
        filename: file.filename,
        state: notebook_to_state(file),
      };
    }),
  });
};

let FileTab = styled.button`
  background: none;
  border: none;

  padding-left: 24px;
  padding-right: 24px;

  &[aria-selected="true"] {
    background: white;
    color: black;
  }
  &:not([aria-selected="true"]):hover {
    background: black;
    color: white;
    text-decoration: underline;
    text-decoration-thickness: 3px;
    text-decoration-skip-ink: none;
    /* text-underline-position: under; */
  }
`;

let workspace_storage = new ScopedStorage("workspace");

function App() {
  let [workspace_json, set_workspace_json] = useScopedStorage(
    workspace_storage,
    DEFAULT_WORKSPACE
  );
  let update_localstorage = React.useMemo(() => {
    return throttle((/** @type {Workspace} */ workspace) => {
      set_workspace_json(
        JSON.stringify(
          /** @type {WorkspaceSerialized} */ ({
            id: workspace.id,
            files: mapValues(workspace.files, (file) => {
              return {
                filename: file.filename,
                notebook: notebook_state_to_notebook_serialized(file.state),
              };
            }),
          })
        )
      );
    }, 500);
  }, [set_workspace_json]);

  let initial_workspace = React.useMemo(() => {
    let workspace = JSON.parse(workspace_json);
    return serialized_workspace_to_workspace(workspace);
  }, []);

  let [workspace, set_workspace] = React.useState(
    // /** @type {Workspace | null} */ (null)
    initial_workspace
  );

  let [open_file, set_open_file] = React.useState(
    /** @type {string | null} */ (null)
  );

  // let socket = useSocket();

  // React.useEffect(() => {
  //   socket.emit("load-workspace-from-directory");
  //   // @ts-ignore
  //   socket.once("load-workspace-from-directory", (workspace) => {
  //     console.log(`workspace YEH:`, workspace);
  //     set_workspace(serialized_workspace_to_workspace(workspace));
  //   });
  // }, []);

  if (workspace == null) {
    return <div></div>;
  }

  if (open_file == null) {
    let first_file = Object.keys(workspace.files)[0];
    if (first_file != null) {
      set_open_file(first_file);
    }
    return <div>Uhh</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          height: 50,
          position: "sticky",
          top: 0,
          backgroundColor: "black",
          zIndex: 1,

          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
        }}
      >
        {Object.keys(workspace.files).map((filename) => (
          <FileTab
            key={filename}
            aria-selected={filename === open_file}
            onClick={() => {
              set_open_file(filename);
            }}
          >
            {filename}
          </FileTab>
        ))}
      </div>

      {open_file == null ? (
        <div></div>
      ) : (
        <NotebookView
          key={open_file}
          state={workspace.files[open_file].state}
          onChange={(state) => {
            let new_workspace = produce(workspace, (workspace) => {
              // @ts-ignore
              workspace.files[open_file].state = state;
            });

            update_localstorage(new_workspace);

            set_workspace(new_workspace);
          }}
        />
      )}
    </div>
  );
}
export default App;
