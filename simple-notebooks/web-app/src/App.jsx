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
  EditorInChiefKeymap,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import { CellOrderField } from "./packages/codemirror-notebook/cell-order.js";
import {
  cell_keymap,
  notebook_keymap,
} from "./packages/codemirror-notebook/add-move-and-run-cells.js";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";
import { add_single_cell_when_all_cells_are_removed } from "./packages/codemirror-notebook/add-cell-when-last-is-removed";

import "./App.css";
import { ScopedStorage, useScopedStorage } from "./use/scoped-storage.js";

import { SocketEnvironment } from "./environment/SocketEnvironment";
import { WorkerEnvironment } from "./environment/WorkerEnvironment";
import { useWorkerStorage, useSocketStorage } from "./use/use-storage";
import { useUrl } from "./packages/use-url/use-url.js";
import {
  ContextMenu,
  ContextMenuWrapper,
} from "./packages/react-contextmenu/react-contextmenu.jsx";
import { Excell } from "./Excel.jsx";

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
        requested_run_time: cell.requested_run_time ?? 0,
        folded: cell.folded,
        type: cell.type,
      })),
    ],
  });
};

/** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId} */
let DEFAULT_CELL_ID_AFTER_CRASH = /** @type {any} */ ("oh-no-what-happened");

/** @param {{ filename: string, notebook: import("./packages/codemirror-notebook/cell").NotebookSerialized}} notebook */
export let notebook_to_state = ({ filename, notebook }) => {
  return EditorInChief.create({
    editors: (editorstate) => {
      return mapValues(notebook.cells, (cell) =>
        create_cell_state(editorstate, cell)
      );
    },
    extensions: [
      CellOrderField.init(() => {
        return notebook.cell_order.filter((x) => {
          if (notebook.cells[x]) {
            return true;
          } else {
            console.warn("cell order has cell that doesn't exist", x);
            return false;
          }
        });
      }),
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
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],

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

// @ts-ignore
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
  let [url, set_url, replace_url] = useUrl();
  let [_, open_file, ...rest] = url.pathname.split("/");
  if (open_file === "") open_file = "notes";
  React.useEffect(() => {
    document.title = open_file;
  }, [open_file]);
  // if (!filename.match(/\.tsx?$|\.jsx?$|.mjsx?$/)) {
  //   replace_url(["", "app", ...rest].join("/"));
  // }

  //////////////////////////////////////////////////////////////

  // let [workspace, set_workspace] = useSocketStorage();
  // let environment = React.useRef(SocketEnvironment).current;

  //////////////////////////////////////////////////////////////

  let [workspace, set_workspace] = useWorkerStorage();
  let environment = React.useRef(WorkerEnvironment).current;

  //////////////////////////////////////////////////////////////

  /** @type {import("./packages/codemirror-notebook/cell").CellId} */
  let EMPTY_TITLE_CELL_ID = /** @type {any} */ ("Something-Wonderful𓃰");
  /** @type {import("./packages/codemirror-notebook/cell").CellId} */
  let EMPTY_CODE_CELL_ID = /** @type {any} */ ("So-Exciting𓆉");

  if (!(open_file in workspace.files)) {
    set_workspace(
      produce(workspace, (workspace) => {
        workspace.files[open_file] = {
          // @ts-ignore
          id: /** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId} */ (
            open_file
          ),
          // @ts-ignore
          state: notebook_to_state({
            filename: open_file,
            notebook: {
              id: /** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId} */ (
                open_file
              ),
              cell_order: [EMPTY_TITLE_CELL_ID, EMPTY_CODE_CELL_ID],
              cells: {
                [EMPTY_TITLE_CELL_ID]:
                  /** @type {import("./packages/codemirror-notebook/cell").Cell} */ ({
                    id: EMPTY_TITLE_CELL_ID,
                    type: "text",
                    unsaved_code: `# ${open_file}`,
                    code: `# ${open_file}`,
                    requested_run_time: 0,
                    folded: false,
                  }),
                [EMPTY_CODE_CELL_ID]:
                  /** @type {import("./packages/codemirror-notebook/cell").Cell} */ ({
                    id: EMPTY_CODE_CELL_ID,
                    type: "code",
                    unsaved_code: "",
                    code: "",
                    requested_run_time: 0,
                    folded: false,
                  }),
              },
            },
          }),
        };
      })
    );
    return;
  }

  if (workspace == null) {
    return <div></div>;
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
          <ContextMenuWrapper
            key={filename}
            options={[
              {
                title: "Remove",
                onClick: () => {
                  if (confirm("Are you sure you want to remove this note?")) {
                    set_workspace(
                      produce(workspace, (workspace) => {
                        delete workspace.files[filename];
                      })
                    );
                  }
                  set_url(`/`);
                },
              },
              {
                title: "Rename",
                onClick: () => {
                  let new_filename = prompt("New note name", filename);
                  if (new_filename == null) return;
                  set_workspace(
                    produce(workspace, (workspace) => {
                      // @ts-ignore
                      workspace[new_filename] = workspace.files[filename];
                      delete workspace.files[filename];
                    })
                  );
                  set_url(`/${new_filename}`);
                },
              },
            ]}
          >
            <FileTab
              aria-selected={filename === open_file}
              onClick={() => {
                set_url(`/${filename}`);
              }}
            >
              {filename}
            </FileTab>
          </ContextMenuWrapper>
        ))}
      </div>

      <Excell />

      {open_file == null ? (
        <div></div>
      ) : (
        <NotebookView
          environment={environment}
          key={open_file}
          state={workspace.files[open_file].state}
          onChange={(state) => {
            let new_workspace = produce(workspace, (workspace) => {
              // @ts-ignore
              workspace.files[open_file].state = state;
            });

            set_workspace(new_workspace);
          }}
        />
      )}
    </div>
  );
}
export default App;
