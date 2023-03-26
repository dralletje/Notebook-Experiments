import React from "react";
import "./App.css";

import { produce } from "immer";
import { io } from "socket.io-client";
import styled from "styled-components";
import {
  CellMetaField,
  CellTypeFacet,
} from "./packages/codemirror-notebook/cell";
import {
  SelectedCellsField,
  selected_cells_keymap,
} from "./packages/codemirror-notebook/cell-selection";
import { keymap } from "@codemirror/view";
import {
  shared_history,
  historyKeymap,
} from "./packages/codemirror-editor-in-chief/codemirror-shared-history";
import { mapValues } from "lodash";
import {
  CellIdOrder,
  cell_movement_extension,
} from "./packages/codemirror-notebook/cell-movement";
import { File } from "./File";
import { NotebookFilename, NotebookId } from "./notebook-types";
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
 *    state: EditorInChief,
 *  }
 * }} files
 */

let cell_id_order_from_notebook_facet = CellIdOrder.compute(
  [CellOrderField.field],
  (state) => state.field(CellOrderField.field)
);

export let create_cell_state = (editorstate, cell) => {
  return create_nested_editor_state({
    parent: editorstate,
    cell_id: cell.id,
    doc: cell.unsaved_code ?? cell.code,
    extensions: [
      CellMetaField.init(() => ({
        code: cell.code,
        is_waiting: cell.is_waiting,
        last_run: cell.last_run,
        folded: cell.folded,
      })),
      CellTypeFacet.of(cell.type ?? "code"),
    ],
  });
};

/** @param {{ filename: string, notebook: import("./notebook-types").NotebookSerialized}} notebook */
let notebook_to_state = ({ filename, notebook }) => {
  return EditorInChief.create({
    editors: (editorstate) =>
      mapValues(notebook.cells, (cell) => create_cell_state(editorstate, cell)),
    extensions: [
      CellOrderField.init(() => notebook.cell_order),

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

      // This works so smooth omg
      [shared_history(), keymap.of(historyKeymap)],

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
