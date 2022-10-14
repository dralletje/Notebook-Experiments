import React from "react";
import "./App.css";

import { produce } from "immer";
import { io, Socket } from "socket.io-client";
import { LastCreatedCells } from "./Notebook";
import styled from "styled-components";
import { EditorState, Facet } from "@codemirror/state";
import {
  CellEditorStatesField,
  CellIdFacet,
  CellMetaField,
  CellPlugin,
  CellTypeFacet,
  editor_state_for_cell,
  nested_cell_states_basics,
  updateListener,
  useNotebookviewWithExtensions,
} from "./NotebookEditor";
import { useRealMemo } from "use-real-memo";
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

// let worker = create_worker();
// console.log(`worker:`, worker);

// post_message(worker, {
//   type: "transform-code",
//   data: {
//     code: `let x = 1;`,
//   },
// }).then((x) => {
//   console.log(`x:`, x);
// });

let cell_id_order_from_notebook_facet = CellIdOrder.compute(
  [CellEditorStatesField],
  (state) => state.field(CellEditorStatesField).cell_order
);

let JustForKicksFacet = Facet.define({});

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
  // {
  //   id: "1",
  //   files: {
  //     "app.js": {
  //       filename: "app.js",
  //       notebook: {
  //         id: "1",
  //         // cell_order: ["1", "2", "3"],
  //         cells: {
  //           1: {
  //             id: "1",
  //             type: "text",
  //             code: "# My notebook",
  //             unsaved_code: "# My notebook",
  //             last_run: Date.now(),
  //             is_waiting: true,
  //           },
  //           2: {
  //             id: "2",
  //             code: "let xs = [1,2,3,4]",
  //             unsaved_code: "let xs = [1,2,3,4]",
  //             last_run: Date.now(),
  //             is_waiting: true,
  //           },
  //           3: {
  //             id: "3",
  //             code: "xs.map((x) => x * 2)",
  //             unsaved_code: "xs.map((x) => x * 2)",
  //             last_run: Date.now(),
  //             is_waiting: true,
  //           },
  //         },
  //       },
  //     }
  //   }
  // }

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
    return <div>Hi</div>;
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
