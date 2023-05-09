import React from "react";
import { produce } from "immer";
import { mapValues } from "lodash";
import styled from "styled-components";
import { CellMetaField } from "./packages/codemirror-notebook/cell";
import {
  shared_history,
  historyKeymap,
} from "./packages/codemirror-editor-in-chief/codemirror-shared-history";
import {
  EditorInChief,
  EditorInChiefKeymap,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";

import { SocketEnvironment } from "./environment/SocketEnvironment";
import { WorkerEnvironment } from "./environment/WorkerEnvironment";
import { useWorkerStorage, useSocketStorage } from "./use/use-storage";
import { useUrl } from "./packages/use-url/use-url.js";
import { ContextMenuWrapper } from "./packages/react-contextmenu/react-contextmenu.jsx";
import { ProjectView } from "./ProjectView";

import {
  empty_notebook,
  editorinchief_to_notebook,
  notebook_to_editorinchief,
} from "./Notebook/notebook-utils";
import {
  editorinchief_to_sheet,
  sheet_to_editorinchief,
} from "./Sheet/sheet-utils";

import { create_codemirror_notebook } from "./packages/codemirror-notebook/codemirror-notebook";

import "./App.css";
import { SelectedCellsField } from "./packages/codemirror-notebook/cell-selection";

/**
 * @typedef Workspace
 * @property {string} id
 * @property {{
 *  [filename: string]: EditorInChief,
 * }} files
 */

/**
 * @typedef Project
 * @type {{
 *  notebook: import("./packages/codemirror-notebook/cell").Notebook,
 *  sheet: import("./Sheet/sheet-utils").SheetSerialized,
 * }}
 */

let NOTEBOOK_EDITOR_ID =
  /** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId} */ (
    "notebook"
  );
let SHEET_EDITOR_ID =
  /** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId} */ (
    "sheet"
  );

let project_to_editorinchief = (/** @type {Project} */ project) => {
  return EditorInChief.create({
    editors: (parent) => {
      return {
        notebook: notebook_to_editorinchief(
          project.notebook,
          parent.section_editor_extensions(NOTEBOOK_EDITOR_ID)
        ),
        sheet: sheet_to_editorinchief(
          project.sheet,
          parent.section_editor_extensions(SHEET_EDITOR_ID)
        ),
      };
    },
    extensions: [],
  });
};
let editorinchief_to_project = (/** @type {EditorInChief} */ editorinchief) => {
  let x = {
    notebook: editorinchief_to_notebook(
      editorinchief.editor(NOTEBOOK_EDITOR_ID)
    ),
    sheet: editorinchief_to_sheet(editorinchief.editor(SHEET_EDITOR_ID)),
  };
  return x;
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
  let environment = React.useRef(WorkerEnvironment).current;

  //////////////////////////////////////////////////////////////

  if (!(open_file in workspace.files)) {
    set_workspace(
      produce(workspace, (/** @type {Workspace} */ workspace) => {
        workspace.files[open_file] = project_to_editorinchief({
          notebook: empty_notebook(open_file),
          sheet: {
            cells: {},
            size: { columns: 26, rows: 50 },
          },
        });
      })
    );
    return;
  }

  if (workspace == null) {
    return <div></div>;
  }

  return (
    <AppStyle>
      <ProjectView
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
    </AppStyle>
  );
}
export default App;

let AppStyle = styled.div`
  /* --header-height: 30px; */
  --header-height: 0px;
  --sidebar-width: 500px;

  display: flex;
  flex-direction: column;
  align-items: stretch;
`;
