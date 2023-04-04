import React from "react";

import styled from "styled-components";
import { isEqual } from "lodash";
import {
  GenericViewUpdate,
  useViewUpdate,
} from "codemirror-x-react/viewupdate";

import {
  SelectCellsEffect,
  SelectedCellsField,
} from "./packages/codemirror-notebook/cell-selection";

import {
  BlurEditorInChiefEffect,
  EditorId,
  EditorIdFacet,
  EditorInChief,
  extract_nested_viewupdate,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
} from "./packages/codemirror-notebook/cell";
import { CellOrderField } from "./packages/codemirror-notebook/cell-order.js";

import { ContextMenuItem } from "./packages/react-contextmenu/react-contextmenu";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";

import { useCodemirrorKeyhandler } from "./use/use-codemirror-keyhandler.js";
import { Logs } from "./Sidebar/Logs/Logs.jsx";
import { useEngine } from "./environment/use-engine.js";
import { Environment } from "./environment/Environment";
import { Excell } from "./ExcellView";
import { useUrl } from "./packages/use-url/use-url";
import { NotebookView } from "./Notebook/NotebookView";
import shadow from "react-shadow/styled-components";
import { AdoptStylesheet, CSSish } from "./yuck/adoptedStyleSheets";

// @ts-ignore
import shadow_notebook_css from "./shadow-notebook.css?inline";
import { EditorState } from "@codemirror/state";
import { EXCEL_CELLS } from "./Sheet/sheet-utils";

let shadow_notebook = new CSSish(shadow_notebook_css);

let Sheet = () => {};

export function ProjectView({
  filename,
  state: _state,
  onChange,
  environment,
}: {
  filename: string;
  state: EditorInChief<any>;
  onChange: (state: any) => void;
  environment: Environment;
}) {
  let _viewupdate = useViewUpdate(_state, onChange);

  let sheet_viewupdate = extract_nested_viewupdate(
    _viewupdate,
    "sheet" as EditorId
  ) as any as GenericViewUpdate<EditorInChief<EditorState>>;
  let notebook_viewupdate = extract_nested_viewupdate(
    _viewupdate,
    "notebook" as EditorId
  ) as any as GenericViewUpdate<EditorInChief<EditorState>>;

  let notebook_editorstates = notebook_viewupdate.state.editors;
  let notebook_cell_order = notebook_viewupdate.state.field(CellOrderField);

  let sheet_editorstates = sheet_viewupdate.state.editors;
  let sheet_cell_order = EXCEL_CELLS;

  let notebook = React.useMemo(() => {
    return /** @type {import("./packages/codemirror-notebook/cell").Notebook} */ {
      cell_order: [...notebook_cell_order, ...sheet_cell_order],
      cells: Object.fromEntries([
        ...notebook_cell_order.map((cell_id) => {
          let cell_state = notebook_editorstates.get(cell_id);
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
        }),
        ...sheet_cell_order.map((cell_id) => {
          let cell_state = sheet_editorstates.get(cell_id);
          return [
            cell_id,
            {
              id: cell_state.facet(EditorIdFacet),
              unsaved_code: cell_state.doc.toString(),
              ...cell_state.field(CellMetaField),
              type: "code",
            },
          ];
        }),
      ]),
    };
  }, [notebook_editorstates, notebook_cell_order]);

  let notebook_with_filename = React.useMemo(() => {
    return { filename: filename, notebook: notebook };
  }, [notebook, filename]);

  let [engine, logs] = useEngine(notebook_with_filename, environment);

  let [url, set_url] = useUrl();
  let tab = url.hash.length === 0 ? "notebook" : url.hash.slice(1);
  let set_tab = (tab) => {
    set_url(`#${tab}`);
  };

  return (
    <div style={{ display: "flex", flex: 1, zIndex: 0 }}>
      <main style={{ overflow: "auto" }}>
        <Excell viewupdate={sheet_viewupdate} engine={engine} />
      </main>

      <Sidebar className={`tab-${tab}`}>
        <nav>
          <a
            href="#notebook"
            className={tab === "notebook" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              set_tab("notebook");
            }}
          >
            Notebook
          </a>
          <a
            href="#logs"
            className={tab === "logs" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              set_tab("logs");
            }}
          >
            Logs
          </a>
        </nav>

        <section>
          {tab === "logs" && (
            <Logs logs={logs} notebook={notebook} engine={engine} />
          )}
          {tab === "notebook" && (
            <shadow.div>
              <AdoptStylesheet stylesheet={shadow_notebook} />
              <NotebookView engine={engine} viewupdate={notebook_viewupdate} />
            </shadow.div>
          )}
        </section>
      </Sidebar>
    </div>
  );
}

let Sidebar = styled.div`
  min-width: 500px;
  width: 600px;

  display: flex;
  flex-direction: column;
  align-items: stretch;
  height: calc(100vh - 50px);
  position: sticky;
  top: 50px;
  overflow-y: auto;
  background-color: black;

  &.tab-notebook {
    background-color: #01412d;
    nav {
      background: #01412d;
    }
  }
  &.tab-logs {
    background-color: rgb(23, 1, 129);
    nav {
      background: rgb(23, 1, 129);
    }
  }

  nav {
    background: , black;
    display: flex;
    flex-direction: row;

    position: sticky;
    top: 0;
    z-index: 1;

    a {
      flex: 1;
      text-align: center;
      padding: 5px 10px;
      font-weight: bold;
      background-color: rgba(0, 0, 0, 0.5);

      &.active {
        background-color: rgba(0, 0, 0, 0);
      }

      &:not(.active):hover {
        background-color: rgba(0, 0, 0, 0.3);
      }
    }
  }

  section {
    display: flex;
    flex-direction: column;
    flex: 1;
    z-index: 0;
  }
`;
