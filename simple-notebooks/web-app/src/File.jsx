import React from "react";

import { io, Socket } from "socket.io-client";
import styled from "styled-components";
import { runScopeHandlers } from "@codemirror/view";
import { isEqual, mapValues, sortBy } from "lodash";
import { EditorState, Facet } from "@codemirror/state";

import {
  BlurAllCells,
  CellEditorStatesField,
  CellIdFacet,
  CellMetaField,
  CellTypeFacet,
  useViewUpdate,
} from "./NotebookEditor";
import { SelectCellsEffect, SelectedCellsField } from "./cell-selection";
import { SelectionArea } from "./selection-area/SelectionArea";
import { NotebookFilename, NotebookId } from "./notebook-types";
import { CellList } from "./Notebook";

let AppStyle = styled.div`
  padding-top: 50px;
  min-height: 100vh;
  padding-bottom: 100px;
  margin-right: 20px;

  flex: 1;
  flex-basis: min(700px, 100vw - 200px, 100%);
  min-width: 0;
`;

/**
 * @param {{ filename: string, notebook: import("./notebook-types").NotebookSerialized }} notebook
 * @param {Socket} socket
 * @returns {import("./notebook-types").EngineShadow}
 */
let useEngine = (notebook, socket) => {
  let [engine, set_engine] = React.useState({ cylinders: {} });
  React.useEffect(() => {
    socket.on("engine", ({ filename, engine }) => {
      if (filename === notebook.filename) {
        set_engine(engine);
      }
    });
    socket;
  }, []);

  React.useEffect(() => {
    let fn = () => {
      socket.emit("notebook", notebook);
    };
    socket.on("connect", fn);
    return () => {
      socket.off("connect", fn);
    };
  }, [notebook, socket]);

  React.useEffect(() => {
    socket.emit("notebook", notebook);
  }, [notebook, socket]);

  return engine;
};

/**
 * @param {{
 *  state: EditorState,
 *  onChange: (state: EditorState) => void,
 *  socket: Socket,
 *  files: { [filename: string]: { filename: string } },
 * }} props
 */
export function File({ state, onChange, socket, files }) {
  let viewupdate = useViewUpdate(state, onChange);

  let cell_editor_states = state.field(CellEditorStatesField);

  let notebook = React.useMemo(() => {
    return /** @type {import("./notebook-types").Notebook} */ ({
      id: state.facet(NotebookId),
      filename: state.facet(NotebookFilename),
      cell_order: cell_editor_states.cell_order,
      cells: mapValues(cell_editor_states.cells, (cell_state) => {
        let type = cell_state.facet(CellTypeFacet);
        return {
          id: cell_state.facet(CellIdFacet),
          unsaved_code: cell_state.doc.toString(),
          ...cell_state.field(CellMetaField),
          type: type,

          // Uhhhh TODO??
          ...(type === "text" ? { code: cell_state.doc.toString() } : {}),
        };
      }),
    });
  }, [cell_editor_states]);

  // Use the nexus' keymaps as shortcuts!
  // This passes on keydown events from the document to the nexus for handling.
  React.useEffect(() => {
    let fn = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      let should_cancel = runScopeHandlers(
        // @ts-ignore
        viewupdate.view,
        event,
        "editor"
      );
      if (should_cancel) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
    };
  }, [viewupdate.view]);

  let notebook_with_filename = React.useMemo(() => {
    return {
      filename: state.facet(NotebookFilename),
      notebook: notebook,
    };
  }, [notebook, state.facet(NotebookFilename)]);

  let engine = useEngine(notebook_with_filename, socket);

  let selected_cells = viewupdate.state.field(SelectedCellsField);

  return (
    <div style={{ display: "flex", flex: 1, zIndex: 0 }}>
      <SelectionArea
        on_selection={(new_selected_cells) => {
          if (!isEqual(new_selected_cells, selected_cells)) {
            viewupdate.view.dispatch({
              effects: [
                SelectCellsEffect.of(new_selected_cells),
                BlurAllCells.of(),
              ],
            });
          }
        }}
      >
        <AppStyle>
          <CellList
            viewupdate={viewupdate}
            notebook={notebook}
            engine={engine}
          />
        </AppStyle>
        <div style={{ flex: 1 }} />
      </SelectionArea>
    </div>
  );
}
