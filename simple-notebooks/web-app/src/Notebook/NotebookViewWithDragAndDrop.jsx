import React from "react";
import styled from "styled-components";
import { isEqual } from "lodash";
import { GenericViewUpdate } from "codemirror-x-react/viewupdate";
import { IonIcon } from "@ionic/react";
import {
  codeOutline,
  eyeOutline,
  planetOutline,
  textOutline,
} from "ionicons/icons";

import {
  SelectCellsEffect,
  SelectedCellsField,
} from "../packages/codemirror-notebook/cell-selection";

import {
  BlurEditorInChiefEffect,
  EditorInChief,
  extract_nested_viewupdate,
} from "codemirror-editor-in-chief";

import { CellTypeFacet } from "../packages/codemirror-notebook/cell";
import { CellOrderField } from "../packages/codemirror-notebook/cell-order.js";
import { LastCreatedCells } from "../packages/codemirror-notebook/last-created-cells.js";

import { SelectionArea } from "../selection-area/SelectionArea";
import { ContextMenuItem } from "../packages/react-contextmenu/react-contextmenu";

import { CellMemo } from "./Cell.jsx";
import { TextCell } from "./TextCell.jsx";
import { CellErrorBoundary } from "./CellErrorBoundary.jsx";
import {
  DragAndDropItem,
  DragAndDropList,
} from "./DragAndDropStuffWorking.jsx";
import * as actions from "./notebook-commands.js";
import { runScopeHandlers } from "@codemirror/view";
import { as_editor_id } from "codemirror-editor-in-chief/dist/logic.js";

// @ts-ignore
let NotebookStyle = styled.div`
  padding-top: 16px;
  /* min-height: 100vh; */
  padding-bottom: 100px;

  max-width: 700px;
`;

/**
 * @param {{
 *  viewupdate: GenericViewUpdate<EditorInChief>,
 *  engine: import("../packages/codemirror-notebook/cell").EngineShadow
 * }} props
 */
export function NotebookViewWithDragAndDrop({ viewupdate, engine }) {
  let { state, view: editor_in_chief } = viewupdate;

  let cell_order = state.field(CellOrderField);
  let selected_cells = state.field(SelectedCellsField);

  /**
   * Keep track of what cells are just created by the users,
   * so we can animate them in 🤩
   */
  let last_created_cells =
    editor_in_chief.state.field(LastCreatedCells, false) ?? [];

  return (
    <SelectionArea
      on_selection={(new_selected_cells) => {
        if (!isEqual(new_selected_cells, selected_cells)) {
          viewupdate.view.dispatch({
            effects: [
              SelectCellsEffect.of(
                new_selected_cells.map((x) => as_editor_id(x))
              ),
              BlurEditorInChiefEffect.of(),
            ],
          });
        }
      }}
    >
      <div
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.defaultPrevented) {
            return;
          }
          let should_cancel = runScopeHandlers(
            // @ts-ignore
            viewupdate.view,
            event,
            // TODO Change this scope to something EditorInChief specific?
            "editor"
          );
          if (should_cancel) {
            event.preventDefault();
          }
        }}
      >
        <NotebookStyle>
          <DragAndDropList editor_in_chief={editor_in_chief}>
            {cell_order.map((cell_id, index) => {
              let cell_viewupdate = extract_nested_viewupdate(
                viewupdate,
                cell_id
              );
              return (
                <DragAndDropItem
                  key={cell_id}
                  index={index}
                  id={cell_id}
                  cell_id={cell_id}
                  editor_in_chief={editor_in_chief}
                  context_options={cell_actions({ editor_in_chief, cell_id })}
                >
                  <CellErrorBoundary>
                    {editor_in_chief.state
                      .editor(cell_id)
                      .facet(CellTypeFacet) === "text" ? (
                      <TextCell
                        cell_id={cell_id}
                        viewupdate={viewupdate}
                        is_selected={selected_cells.includes(cell_id)}
                        did_just_get_created={last_created_cells.includes(
                          cell_id
                        )}
                      />
                    ) : (
                      <CellMemo
                        cell_id={cell_id}
                        viewupdate={cell_viewupdate}
                        cylinder={engine.cylinders[cell_id]}
                        is_selected={selected_cells.includes(cell_id)}
                        did_just_get_created={last_created_cells.includes(
                          cell_id
                        )}
                      />
                    )}
                  </CellErrorBoundary>
                </DragAndDropItem>
              );
            })}
          </DragAndDropList>
        </NotebookStyle>
        <div style={{ flex: 1, minWidth: 16 }} />
      </div>
    </SelectionArea>
  );
}

/**
 * @param {{
 *  editor_in_chief: import("codemirror-x-react/viewupdate.js").EditorView<EditorInChief>,
 *  cell_id: import("../packages/codemirror-notebook/cell").CellId,
 * }} props
 */
let cell_actions = ({ editor_in_chief, cell_id }) => [
  {
    title: (
      <ContextMenuItem
        icon={<IonIcon icon={textOutline} />}
        label="Add Text Above"
      />
    ),
    onClick: () =>
      actions.add_text_above.run({ editor_in_chief, cell_id: cell_id }),
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
      actions.add_code_below.run({ editor_in_chief, cell_id: cell_id }),
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
      actions.delete_cell.run({ editor_in_chief, cell_id: cell_id }),
  },
  {
    title: (
      <ContextMenuItem icon={<IonIcon icon={eyeOutline} />} label="Fold" />
    ),
    onClick: () => actions.fold_cell.run({ editor_in_chief, cell_id: cell_id }),
  },
];
