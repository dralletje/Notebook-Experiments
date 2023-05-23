import React from "react";
import { produce } from "immer";
import { mapValues } from "lodash";
import styled from "styled-components";
import { CellMetaField } from "./packages/codemirror-notebook/cell";
import {
  shared_history,
  historyKeymap,
} from "codemirror-editor-in-chief/history";
import { EditorInChief, as_editor_id } from "codemirror-editor-in-chief";

import { SocketEnvironment } from "./environment/SocketEnvironment";
import { InpageEnvironment } from "./environment/in-page-environment/InpageEnvironment.js";
import { WorkerEnvironment } from "./environment/worker-environment-worker/WorkerEnvironment";
import { useWorkerStorage, useSocketStorage } from "./use/use-storage";
import { useUrl } from "./packages/use-url/use-url.js";
import { ContextMenuWrapper } from "./packages/react-contextmenu/react-contextmenu.jsx";

import {
  empty_notebook,
  editorinchief_to_notebook,
  notebook_to_editorinchief,
} from "./Notebook/notebook-utils";
import { create_codemirror_notebook } from "./packages/codemirror-notebook/codemirror-notebook";

import "./App.css";
import { SelectedCellsField } from "./packages/codemirror-notebook/cell-selection";
import { NotebookView } from "./Notebook/NotebookView.jsx";
import { IndependentNotebook } from "./IndependentNotebook";
import { EditorState } from "@codemirror/state";

/**
 * @typedef Workspace
 * @property {string} id
 * @property {{
 *  [filename: string]: EditorInChief,
 * }} files
 */

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

/**
 * @typedef Project
 * @type {{
 *  notebook: import("./packages/codemirror-notebook/cell").Notebook,
 * }}
 */

let project_to_editorinchief = (/** @type {Project} */ project) => {
  return notebook_to_editorinchief(project.notebook);
};
let editorinchief_to_project = (
  /** @type {EditorInChief<{ [key: string]: EditorState }>} */ editorinchief
) => {
  return { notebook: editorinchief_to_notebook(editorinchief) };
};

function App() {
  let [url, set_url, replace_url] = useUrl();
  let [_, open_file, ...rest] = url.pathname.split("/");
  if (open_file === "") open_file = "notes";
  React.useEffect(() => {
    document.title = open_file;
  }, [open_file]);

  //////////////////////////////////////////////////////////////

  // let [workspace, set_workspace] = useSocketStorage();
  // let environment = React.useRef(SocketEnvironment).current;

  //////////////////////////////////////////////////////////////

  let [workspace, set_workspace] = useWorkerStorage({
    deserialize: project_to_editorinchief,
    serialize: editorinchief_to_project,
  });
  let environment = React.useRef(InpageEnvironment).current;

  //////////////////////////////////////////////////////////////

  if (!(open_file in workspace.files)) {
    set_workspace(
      produce(workspace, (/** @type {Workspace} */ workspace) => {
        workspace.files[open_file] = project_to_editorinchief({
          notebook: empty_notebook(open_file),
        });
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

        // @ts-ignore
        "--header-height": "50px",
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

      <IndependentNotebook
        key={open_file}
        filename={open_file}
        environment={environment}
        state={workspace.files[open_file]}
        onChange={(state) => {
          set_workspace(
            produce(workspace, (workspace) => {
              workspace.files[open_file] = /** @type {any} */ (state);
            })
          );
        }}
      />
    </div>
  );
}
export default App;
