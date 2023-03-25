import React from "react";
import "./App.css";

import { produce } from "immer";
import { io } from "socket.io-client";
import { LastCreatedCells } from "./Notebook";
import styled from "styled-components";
import { EditorState, Facet } from "@codemirror/state";
import {
  CellEditorStatesField,
  CellMetaField,
  CellPlugin,
  editor_state_for_cell,
  nested_cell_states_basics,
} from "./NotebookEditor";
import { SelectedCellsField, selected_cells_keymap } from "./cell-selection";
import { EditorView, keymap, runScopeHandlers } from "@codemirror/view";
import {
  shared_history,
  historyKeymap,
} from "./packages/codemirror-nexus/codemirror-shared-history";
import { mapValues } from "lodash";
import {
  CellIdOrder,
  cell_movement_extension_default,
} from "./packages/codemirror-nexus/codemirror-cell-movement";
import { notebook_keymap } from "./packages/codemirror-nexus/add-move-and-run-cells";
import { File } from "./File";
import { NotebookFilename, NotebookId } from "./notebook-types";
import { typescript_extension } from "./packages/typescript-server-webworker/codemirror-typescript.js";

let cell_id_order_from_notebook_facet = CellIdOrder.compute(
  [CellEditorStatesField],
  (state) => state.field(CellEditorStatesField).cell_order
);

/**
 * @typedef WorkspaceSerialized
 * @property {string} id
 * @property {{
 *  [filename: string]: {
 *    filename: string,
 *    notebook: import("./notebook-types").NotebookSerialized,
 *  }
 * }} files
 */

/**
 * @typedef Workspace
 * @property {string} id
 * @property {{
 *  [filename: string]: {
 *    filename: string,
 *    state: EditorState,
 *  }
 * }} files
 */

/** @param {{ filename: string, notebook: import("./notebook-types").NotebookSerialized}} notebook */
let notebook_to_state = ({ filename, notebook }) => {
  let notebook_state = CellEditorStatesField.init((editorstate) => {
    return {
      cell_order: notebook.cell_order,
      cells: mapValues(notebook.cells, (cell) => {
        return editor_state_for_cell(cell, editorstate);
      }),
      transactions_to_send_to_cells: [],
      cell_with_current_selection: null,
    };
  });
  return EditorState.create({
    extensions: [
      notebook_state,
      nested_cell_states_basics,

      notebook_keymap,

      SelectedCellsField,
      cell_id_order_from_notebook_facet,

      cell_movement_extension_default,
      selected_cells_keymap,
      LastCreatedCells,

      // This works so smooth omg
      [shared_history(), keymap.of(historyKeymap)],

      NotebookId.of(notebook.id),
      NotebookFilename.of(filename),

      // typescript_extension((state) => {
      //   let notebook = state.field(CellEditorStatesField);

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

      CellPlugin.of(
        EditorView.scrollMargins.of(() => ({ top: 100, bottom: 100 }))
      ),

      // just_for_kicks_extension
      // UpdateLocalStorage,
    ],
  });
};

let useSocket = () => {
  let socket = React.useMemo(() => {
    return io("http://localhost:3099", {
      autoConnect: false,
    });
  }, []);
  React.useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    return () => {
      socket.close();
    };
  }, [socket]);
  return socket;
};

let serialized_workspace_to_workspace = (serialized) => {
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

function App() {
  let [workspace, set_workspace] = React.useState(
    /** @type {Workspace | null} */ (null)
  );

  let [open_file, set_open_file] = React.useState(
    /** @type {string | null} */ (null)
  );

  let socket = useSocket();

  React.useEffect(() => {
    socket.emit("load-workspace-from-directory");
    socket.once("load-workspace-from-directory", (workspace) => {
      console.log(`workspace:`, workspace);
      set_workspace(serialized_workspace_to_workspace(workspace));
    });
  }, []);

  if (workspace == null) {
    return <div></div>;
  }

  if (open_file == null) {
    let first_file = Object.keys(workspace.files)[0];
    if (first_file != null) {
      set_open_file(first_file);
    }
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
        <File
          files={workspace.files}
          key={open_file}
          socket={socket}
          state={workspace.files[open_file].state}
          onChange={(state) => {
            set_workspace(
              produce((workspace) => {
                // @ts-ignore
                workspace.files[open_file].state = state;
              })
            );
          }}
        />
      )}
    </div>
  );
}
export default App;
