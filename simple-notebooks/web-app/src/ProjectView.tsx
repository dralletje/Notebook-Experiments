import React from "react";

import styled from "styled-components";
import { isEqual } from "lodash";
import { useViewUpdate } from "codemirror-x-react/viewupdate";

import {
  SelectCellsEffect,
  SelectedCellsField,
} from "./packages/codemirror-notebook/cell-selection";
import { SelectionArea } from "./selection-area/SelectionArea";
import {
  NotebookFilename,
  NotebookId,
} from "./packages/codemirror-notebook/cell";

import {
  BlurEditorInChiefEffect,
  EditorIdFacet,
  EditorInChief,
  extract_nested_viewupdate,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
} from "./packages/codemirror-notebook/cell";
import { CellOrderField } from "./packages/codemirror-notebook/cell-order.js";

import { IonIcon } from "@ionic/react";
import {
  codeOutline,
  eyeOutline,
  planetOutline,
  textOutline,
} from "ionicons/icons";
import { ContextMenuItem } from "./packages/react-contextmenu/react-contextmenu";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";

import { CellMemo } from "./Cell.jsx";
import { TextCell } from "./TextCell.jsx";
import { CellErrorBoundary } from "./yuck/CellErrorBoundary.jsx";
import { DragAndDropItem, DragAndDropList } from "./yuck/DragAndDropStuff.jsx";
import { useCodemirrorKeyhandler } from "./use/use-codemirror-keyhandler.js";
import { actions } from "./commands.js";
import { Sidebar } from "./Sidebar.jsx";
import { Logs } from "./Sidebar/Logs/Logs.jsx";
import { useEngine } from "./environment/use-engine.js";
import { Environment } from "./environment/Environment";
import { Excell } from "./Excel";
import { useUrl } from "./packages/use-url/use-url";
import { NotebookView } from "./NotebookView";

// @ts-ignore
let NotebookStyle = styled.div`
  padding-top: 50px;
  min-height: 100vh;
  padding-bottom: 100px;

  flex: 1;
  flex-basis: clamp(700px, 100vw - 200px, 900px);
  flex-grow: 0;

  min-width: 0;
`;

export function ProjectView({
  state,
  onChange,
  environment,
}: {
  state: EditorInChief;
  onChange: (state: EditorInChief) => void;
  environment: Environment;
}) {
  let viewupdate = useViewUpdate(state, onChange);
  useCodemirrorKeyhandler(viewupdate);

  let cell_editor_states = state.editors;
  let cell_order = state.field(CellOrderField);
  let selected_cells = viewupdate.state.field(SelectedCellsField);
  let editor_in_chief = viewupdate.view;

  let notebook = React.useMemo(() => {
    return /** @type {import("./packages/codemirror-notebook/cell").Notebook} */ {
      id: state.facet(NotebookId),
      filename: state.facet(NotebookFilename),
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
  }, [cell_editor_states, cell_order]);

  let notebook_with_filename = React.useMemo(() => {
    return {
      filename: state.facet(NotebookFilename),
      notebook: notebook,
    };
  }, [notebook, state.facet(NotebookFilename)]);

  let [engine, logs] = useEngine(notebook_with_filename, environment);

  let [url, set_url] = useUrl();
  let tab = url.hash.length === 0 ? "notebook" : url.hash.slice(1);
  let set_tab = (tab) => {
    set_url(`#${tab}`);
  };

  return (
    <div style={{ display: "flex", flex: 1, zIndex: 0 }}>
      <Excell />

      <div
        style={{
          width: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          height: `calc(100vh - 50px)`,
          position: "sticky",
          top: 50,
          overflowY: "auto",
          backgroundColor: "black",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
          }}
        >
          <a
            href="#notebook"
            onClick={(e) => {
              e.preventDefault();
              set_tab("notebook");
            }}
          >
            Notebook
          </a>
          <a
            href="#logs"
            onClick={(e) => {
              e.preventDefault();
              set_tab("logs");
            }}
          >
            Logs
          </a>
        </div>

        <div>
          {tab === "logs" && (
            <Logs logs={logs} notebook={notebook} engine={engine} />
          )}
          {tab === "notebook" && (
            <NotebookView engine={engine} viewupdate={viewupdate} />
          )}
        </div>
      </div>
    </div>
  );
}
