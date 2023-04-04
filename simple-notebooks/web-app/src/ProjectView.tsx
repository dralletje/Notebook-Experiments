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

import { useCodemirrorKeyhandler } from "./use/use-codemirror-keyhandler.js";
import { actions } from "./commands.js";
import { Logs } from "./Sidebar/Logs/Logs.jsx";
import { useEngine } from "./environment/use-engine.js";
import { Environment } from "./environment/Environment";
import { Excell } from "./ExcellView";
import { useUrl } from "./packages/use-url/use-url";
import { NotebookView } from "./NotebookView";
import shadow from "react-shadow/styled-components";
import { AdoptStylesheet, CSSish } from "./yuck/adoptedStyleSheets";

// @ts-ignore
import shadow_notebook_css from "./shadow-notebook.css?inline";

let shadow_notebook = new CSSish(shadow_notebook_css);

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
      <main style={{ overflow: "auto" }}>
        <Excell />
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
              <NotebookView engine={engine} viewupdate={viewupdate} />
            </shadow.div>
          )}
        </section>
      </Sidebar>
    </div>
  );
}

let NOISE_BACKGROUND = new URL(
  "./yuck/noise-background.png",
  import.meta.url
).toString();

let Sidebar = styled.div`
  min-width: 300px;
  width: 400px;
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
      border-bottom: solid 3px #081c14;
    }
  }
  &.tab-logs {
    background-color: rgba(23, 1, 129, 0.27);
    nav {
      border-bottom: solid 1px #090715;
    }
  }

  nav {
    background: url(${NOISE_BACKGROUND}), rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: row;

    a {
      flex: 1;
      text-align: center;
      padding: 5px 10px;
      font-weight: bold;

      &.active {
        background-color: rgba(0, 0, 0, 0.5);
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
  }
`;
