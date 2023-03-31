import React from "react";

import styled from "styled-components";
import { isEqual, mapValues } from "lodash";
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
import { useEngine } from "./use/use-engine";

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
import { useLocalEnvironment } from "./use/use-local-environment.js";
import { Logs } from "./Sidebar/Logs.jsx";

let NotebookStyle = styled.div`
  padding-top: 50px;
  min-height: 100vh;
  padding-bottom: 100px;

  flex: 1;
  flex-basis: clamp(700px, 100vw - 200px, 900px);
  flex-grow: 0;

  min-width: 0;
`;

/**
 * @param {{
 *  state: EditorInChief,
 *  onChange: (state: EditorInChief) => void,
 * }} props
 */
export function NotebookView({ state, onChange }) {
  let viewupdate = useViewUpdate(state, onChange);
  useCodemirrorKeyhandler(viewupdate);

  let cell_editor_states = state.editors;
  let cell_order = state.field(CellOrderField);
  let selected_cells = viewupdate.state.field(SelectedCellsField);
  let editor_in_chief = viewupdate.view;

  /**
   * Keep track of what cells are just created by the users,
   * so we can animate them in 🤩
   */
  let last_created_cells =
    editor_in_chief.state.field(LastCreatedCells, false) ?? [];

  let notebook = React.useMemo(() => {
    return /** @type {import("./packages/codemirror-notebook/cell").Notebook} */ ({
      id: state.facet(NotebookId),
      filename: state.facet(NotebookFilename),
      cell_order: state.field(CellOrderField),
      cells: mapValues(cell_editor_states, (cell_state) => {
        let type = cell_state.facet(CellTypeFacet);
        return {
          id: cell_state.facet(EditorIdFacet),
          unsaved_code: cell_state.doc.toString(),
          ...cell_state.field(CellMetaField),
          type: type,

          // This autosaves the text cells
          // TODO? Do we want this?
          ...(type === "text" ? { code: cell_state.doc.toString() } : {}),
        };
      }),
    });
  }, [cell_editor_states, cell_order]);

  let notebook_with_filename = React.useMemo(() => {
    return {
      filename: state.facet(NotebookFilename),
      notebook: notebook,
    };
  }, [notebook, state.facet(NotebookFilename)]);

  // let engine = useEngine(notebook_with_filename, socket);
  let [engine, logs] = useLocalEnvironment(notebook_with_filename);

  return (
    <div style={{ display: "flex", flex: 1, zIndex: 0 }}>
      <SelectionArea
        on_selection={(new_selected_cells) => {
          if (!isEqual(new_selected_cells, selected_cells)) {
            viewupdate.view.dispatch({
              effects: [
                SelectCellsEffect.of(new_selected_cells),
                BlurEditorInChiefEffect.of(),
              ],
            });
          }
        }}
      >
        <NotebookStyle>
          <DragAndDropList editor_in_chief={editor_in_chief}>
            {cell_order
              .map((cell_id) => notebook.cells[cell_id])
              .map((cell, index) => (
                <DragAndDropItem
                  key={cell.id}
                  index={index}
                  id={cell.id}
                  cell_id={cell.id}
                  editor_in_chief={editor_in_chief}
                  context_options={cell_actions({ editor_in_chief, cell })}
                >
                  <CellErrorBoundary>
                    {editor_in_chief.state
                      .editor(cell.id)
                      .facet(CellTypeFacet) === "text" ? (
                      <TextCell
                        cell_id={cell.id}
                        viewupdate={viewupdate}
                        is_selected={selected_cells.includes(cell.id)}
                        did_just_get_created={last_created_cells.includes(
                          cell.id
                        )}
                      />
                    ) : (
                      <CellMemo
                        cell_id={cell.id}
                        viewupdate={extract_nested_viewupdate(
                          viewupdate,
                          cell.id
                        )}
                        cylinder={engine.cylinders[cell.id]}
                        is_selected={selected_cells.includes(cell.id)}
                        did_just_get_created={last_created_cells.includes(
                          cell.id
                        )}
                      />
                    )}
                  </CellErrorBoundary>
                </DragAndDropItem>
              ))}
          </DragAndDropList>
        </NotebookStyle>
        <div style={{ flex: 1, minWidth: 16 }} />
      </SelectionArea>
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
        }}
      >
        <Logs
          logs={logs}
          notebook={notebook}
          engine={engine}
          viewupdate={viewupdate}
        />
      </div>
    </div>
  );
}

/**
 * @param {{
 *  editor_in_chief: import("codemirror-x-react/viewupdate.js").EditorView<EditorInChief>,
 *  cell: import("./packages/codemirror-notebook/cell.js").Cell,
 * }} props
 */
let cell_actions = ({ editor_in_chief, cell }) => [
  {
    title: (
      <ContextMenuItem
        icon={<IonIcon icon={textOutline} />}
        label="Add Text Above"
      />
    ),
    onClick: () =>
      actions.add_text_above.run({ editor_in_chief, cell_id: cell.id }),
  },
  {
    title: (
      <ContextMenuItem
        icon={<IonIcon icon={codeOutline} />}
        label="Add Code Cell Below"
        shortcut="⌘K"
      />
    ),
    onClick: () =>
      actions.add_code_below.run({ editor_in_chief, cell_id: cell.id }),
  },
  {
    title: (
      <ContextMenuItem
        icon={<IonIcon icon={planetOutline} />}
        label="Delete"
        shortcut="⌘K"
      />
    ),
    onClick: () =>
      actions.delete_cell.run({ editor_in_chief, cell_id: cell.id }),
  },
  {
    title: (
      <ContextMenuItem icon={<IonIcon icon={eyeOutline} />} label="Fold" />
    ),
    onClick: () => actions.fold_cell.run({ editor_in_chief, cell_id: cell.id }),
  },
];
