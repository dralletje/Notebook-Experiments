import React from "react";

import styled from "styled-components";
import { useViewUpdate } from "codemirror-x-react/viewupdate";

import { EditorIdFacet, EditorInChief } from "codemirror-editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
} from "./packages/codemirror-notebook/cell";
import { CellOrderField } from "./packages/codemirror-notebook/cell-order.js";

import { useEngine } from "./environment/use-engine.js";
import { Environment } from "./environment/Environment";
import { useUrl } from "./packages/use-url/use-url";

import { NotebookViewWithDragAndDrop } from "./Notebook/NotebookViewWithDragAndDrop";
import { EditorState } from "@codemirror/state";

let Sheet = () => {};

type NotebookEditorInChief = EditorInChief<{ [k: string]: EditorState }>;

export function IndependentNotebook({
  filename,
  state,
  onChange,
  environment,
}: {
  filename: string;
  state: NotebookEditorInChief;
  onChange: (state: NotebookEditorInChief) => void;
  environment: Environment;
}) {
  let notebook_viewupdate = useViewUpdate(state, onChange);

  let notebook_cell_order = notebook_viewupdate.state.field(CellOrderField);

  let notebook = React.useMemo(() => {
    return /** @type {import("./packages/codemirror-notebook/cell").Notebook} */ {
      cell_order: notebook_cell_order,
      cells: Object.fromEntries([
        ...notebook_cell_order.map((cell_id) => {
          let cell_state = notebook_viewupdate.state.editor(cell_id);
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
      ]),
    };
  }, [notebook_viewupdate.state.editors, notebook_cell_order]);

  let notebook_with_filename = React.useMemo(() => {
    return { filename: filename, notebook: notebook };
  }, [notebook, filename]);

  let [engine, logs, deserialize] = useEngine(
    notebook_with_filename,
    environment
  );

  let [url, set_url] = useUrl();
  let tab = url.hash.length === 0 ? "notebook" : url.hash.slice(1);
  let set_tab = (tab) => {
    set_url(`#${tab}`);
  };

  return (
    <div style={{ display: "flex", flex: 1, zIndex: 0 }}>
      <main style={{ overflow: "auto", flex: 1 }}>
        <NotebookViewWithDragAndDrop
          deserialize={engine.deserialize}
          engine={engine}
          viewupdate={notebook_viewupdate}
        />
      </main>

      <Canvas></Canvas>
    </div>
  );
}

let Canvas = styled.div`
  flex-basis: 400px;
  min-width: 300px;
  flex-shrink: 1;

  display: flex;
  flex-direction: column;
  align-items: stretch;
  height: calc(100vh - var(--header-height));
  position: sticky;
  top: 50px;
  overflow-y: auto;
  background-color: black;

  nav {
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
