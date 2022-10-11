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
  CellTypeFacet,
  editor_state_for_cell,
  nested_cell_states_basics,
  updateListener,
  useNotebookviewWithExtensions,
} from "./NotebookEditor";
import { useRealMemo } from "use-real-memo";
import { SelectedCellsField, selected_cells_keymap } from "./cell-selection";
import { keymap, runScopeHandlers } from "@codemirror/view";
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
import { blur_stuff } from "./blur-stuff";
import { File } from "./File";

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

let LOCALSTORAGE_WORKSPACE_KEY = "__workspace";

let try_json = (str) => {
  try {
    return JSON.parse(str);
  } catch (error) {
    return null;
  }
};

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

/** @param {{ workspace: Workspace }} props */
let useEngine = ({ workspace }) => {
  let [engine, set_engine] = React.useState({ cylinders: {} });
  /** @type {React.MutableRefObject<Socket<any, any>>} */
  let socketio_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    let socket = io("http://localhost:3099");

    socket.on("engine", (engine) => {
      set_engine(engine);
    });
    socketio_ref.current = socket;

    return () => {
      socket.close();
    };
  }, []);

  React.useEffect(() => {
    let socket = socketio_ref.current;
    let fn = () => {
      socket.emit("workspace", workspace);
    };
    socket.on("connect", fn);
    return () => {
      socket.off("connect", fn);
    };
  }, [workspace]);

  React.useEffect(() => {
    let socket = socketio_ref.current;
    socket.emit("workspace", workspace);
  }, [workspace]);

  return engine;
};

/** @param {import("./notebook-types").NotebookSerialized} notebook */
let notebook_to_state = (notebook) => {
  let notebook_state = CellEditorStatesField.init((editorstate) => {
    return {
      cell_order: notebook.cell_order,
      cells: mapValues(notebook.cells, (cell) => {
        return editor_state_for_cell(cell, editorstate);
      }),
      transactions_to_send_to_cells: [],
      has_active_selection: {},
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

      blur_stuff,

      // This works so smooth omg
      [shared_history(), keymap.of(historyKeymap)],

      // just_for_kicks_extension
      // UpdateLocalStorage,
    ],
  });
};

function App() {
  let initial_workspace = React.useMemo(() => {
    let plain = /** @type {WorkspaceSerialized} */ (
      try_json(localStorage.getItem(LOCALSTORAGE_WORKSPACE_KEY))
    ) ?? {
      id: "1",
      files: {
        "app.js": {
          filename: "app.js",
          notebook: {
            id: "1",
            // cell_order: ["1", "2", "3"],
            cell_order: ["2"],
            cells: {
              // 1: {
              //   id: "1",
              //   type: "text",
              //   code: "# My notebook",
              //   unsaved_code: "# My notebook",
              //   last_run: Date.now(),
              //   is_waiting: true,
              // },
              2: {
                id: "2",
                code: "let xs = [1,2,3,4]",
                unsaved_code: "let xs = [1,2,3,4]",
                last_run: Date.now(),
                is_waiting: true,
              },
              // 3: {
              //   id: "3",
              //   code: "xs.map((x) => x * 2)",
              //   unsaved_code: "xs.map((x) => x * 2)",
              //   last_run: Date.now(),
              //   is_waiting: true,
              // },
            },
          },
        },
        // "thing.js": {
        //   filename: "app.js",
        //   notebook: {
        //     id: "1",
        //     cell_order: ["1", "2", "3"],
        //     cells: {
        //       1: {
        //         id: "1",
        //         type: "text",
        //         code: "# My notebook",
        //         unsaved_code: "# My notebook",
        //         last_run: Date.now(),
        //         is_waiting: true,
        //       },
        //       2: {
        //         id: "2",
        //         code: "let xs = [1,2,3,4]",
        //         unsaved_code: "let xs = [1,2,3,4]",
        //         last_run: Date.now(),
        //         is_waiting: true,
        //       },
        //       3: {
        //         id: "3",
        //         code: "xs.map((x) => x * 2)",
        //         unsaved_code: "xs.map((x) => x * 2)",
        //         last_run: Date.now(),
        //         is_waiting: true,
        //       },
        //     },
        //   },
        // },
      },
    };

    return /** @type {Workspace} */ ({
      id: plain.id,
      files: mapValues(plain.files, (file) => {
        return {
          filename: file.filename,
          state: notebook_to_state(file.notebook),
        };
      }),
    });
  }, []);

  let [workspace, set_workspace] = React.useState(initial_workspace);

  let [open_file, set_open_file] = React.useState("app.js");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <div>
        {Object.keys(workspace.files).map((filename) => (
          <button
            key={filename}
            onClick={() => {
              set_open_file(filename);
            }}
          >
            {filename}
          </button>
        ))}
      </div>
      <File
        key={open_file}
        state={workspace.files[open_file].state}
        // onChange={(state) => {
        //   set_workspace(
        //     produce((workspace) => {
        //       console.log("updating workspace");
        //       workspace.files[open_file].state = state;
        //     })
        //   );
        // }}
      />
    </div>
  );
}
export default App;
