import React from "react";

import styled from "styled-components";
import { runScopeHandlers } from "@codemirror/view";
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
  EditorAddEffect,
  EditorDispatchEffect,
  EditorRemoveEffect,
  EditorInChief,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
  MutateCellMetaEffect,
  empty_cell,
} from "./packages/codemirror-notebook/cell";
import {
  CellOrderEffect,
  CellOrderField,
} from "./packages/codemirror-notebook/cell-order.js";
import { useEngine } from "./use/use-engine";

import { IonIcon } from "@ionic/react";
import {
  codeOutline,
  eyeOutline,
  planetOutline,
  textOutline,
} from "ionicons/icons";
import { ContextMenuItem } from "./packages/react-contextmenu/react-contextmenu";
import { create_cell_state } from "./App.jsx";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";

import { CellMemo } from "./Cell.jsx";
import { TextCell } from "./TextCell.jsx";
import { CellErrorBoundary } from "./yuck/CellErrorBoundary.jsx";
import { DragAndDropItem, DragAndDropList } from "./yuck/DragAndDropStuff.jsx";
import { useCodemirrorKeyhandler } from "./use/use-codemirror-keyhandler.js";

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
 * @param {{
 *  state: EditorInChief,
 *  onChange: (state: EditorInChief) => void,
 *  socket: import("socket.io-client").Socket,
 *  files: { [filename: string]: { filename: string } },
 * }} props
 */
export function File({ state, onChange, socket, files }) {
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

          // Uhhhh TODO??
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

  let engine = useEngine(notebook_with_filename, socket);

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
        <AppStyle>
          <DragAndDropList editor_in_chief={editor_in_chief}>
            {cell_order
              .map((cell_id) => notebook.cells[cell_id])
              .map((cell, index) => (
                <DragAndDropItem
                  key={cell.id}
                  index={index}
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
                        viewupdate={viewupdate}
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
        </AppStyle>
        <div style={{ flex: 1 }} />
      </SelectionArea>
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
    onClick: () => {
      let cell_order = editor_in_chief.state.field(CellOrderField);
      let my_index = cell_order.indexOf(cell.id);
      let new_cell = empty_cell("text");
      editor_in_chief.dispatch({
        effects: [
          EditorAddEffect.of({
            editor_id: new_cell.id,
            state: create_cell_state(editor_in_chief.state, new_cell),
          }),
          CellOrderEffect.of({
            cell_id: new_cell.id,
            index: my_index,
          }),
          EditorDispatchEffect.of({
            editor_id: new_cell.id,
            transaction: { selection: { anchor: 0 } },
          }),
        ],
      });
    },
  },
  {
    title: (
      <ContextMenuItem
        icon={<IonIcon icon={codeOutline} />}
        label="Add Code Cell Below"
        shortcut="⌘K"
      />
    ),
    onClick: () => {
      let cell_order = editor_in_chief.state.field(CellOrderField);
      let my_index = cell_order.indexOf(cell.id);
      let new_cell = empty_cell();
      editor_in_chief.dispatch({
        effects: [
          EditorAddEffect.of({
            editor_id: new_cell.id,
            state: create_cell_state(editor_in_chief.state, new_cell),
          }),
          CellOrderEffect.of({
            cell_id: new_cell.id,
            index: my_index + 1,
          }),
          EditorDispatchEffect.of({
            editor_id: new_cell.id,
            transaction: { selection: { anchor: 0 } },
          }),
        ],
      });
    },
  },
  {
    title: (
      <ContextMenuItem
        icon={<IonIcon icon={planetOutline} />}
        label="Delete"
        shortcut="⌘K"
      />
    ),
    onClick: () => {
      editor_in_chief.dispatch({
        effects: [
          CellOrderEffect.of({
            index: null,
            cell_id: cell.id,
          }),
          EditorRemoveEffect.of({ editor_id: cell.id }),
        ],
      });
    },
  },
  {
    title: (
      <ContextMenuItem icon={<IonIcon icon={eyeOutline} />} label="Fold" />
    ),
    onClick: () => {
      editor_in_chief.dispatch({
        effects: EditorDispatchEffect.of({
          editor_id: cell.id,
          transaction: {
            effects: MutateCellMetaEffect.of((cell) => {
              cell.folded = !cell.folded;
            }),
          },
        }),
      });
    },
  },
];
