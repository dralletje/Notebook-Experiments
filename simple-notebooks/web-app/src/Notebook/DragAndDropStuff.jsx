import React from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { Flipper, Flipped } from "react-flip-toolkit";
import styled from "styled-components";

import {
  BlurEditorInChiefEffect,
  EditorDispatchEffect,
  EditorInChief,
} from "../packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellOrderEffect,
  CellOrderField,
} from "../packages/codemirror-notebook/cell-order";
import { ContextMenuWrapper } from "../packages/react-contextmenu/react-contextmenu";
import {
  CellTypeFacet,
  MutateCellMetaEffect,
} from "../packages/codemirror-notebook/cell";
import { compact } from "lodash";

let DragAndDropListStyle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/**
 * @param {{
 * children: React.ReactNode,
 *  editor_in_chief: import("codemirror-x-react/viewupdate.js").EditorView<EditorInChief>,
 * }} props
 */
export let DragAndDropList = ({ children, editor_in_chief }) => {
  let cell_order = editor_in_chief.state.field(CellOrderField);

  return (
    <DragAndDropListStyle>
      <div data-can-start-selection className="flex flex-col">
        {children}
      </div>
    </DragAndDropListStyle>
  );
};

let CellContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 0.5rem;

  will-change: transform;

  &.dragging,
  &:has(.drag-handle:hover),
  &:has(.menu:focus) {
    z-index: 1;
  }
`;

/**
 * @param {{
 *  children: React.ReactNode,
 *  cell_id: import("../packages/codemirror-notebook/cell").CellId,
 *  index: number,
 *  editor_in_chief: import("codemirror-x-react/viewupdate.js").EditorView<EditorInChief>,
 *  context_options: any[],
 *  id?: string,
 * }} props
 */
export let DragAndDropItem = ({
  children,
  cell_id,
  index,
  editor_in_chief,
  context_options,
  id,
}) => {
  let cell_type = editor_in_chief.state.editor(cell_id).facet(CellTypeFacet);
  return (
    <CellContainer
      id={id}
      data-can-start-selection={false}
      className={compact(["cell-container", `cell-${cell_type}`]).join(" ")}
    >
      <ContextMenuWrapper options={context_options}>
        <div
          style={{ minWidth: 20 }}
          onClick={() => {
            editor_in_chief.dispatch({
              effects: [
                EditorDispatchEffect.of({
                  editor_id: cell_id,
                  transaction: {
                    effects: MutateCellMetaEffect.of((cell) => {
                      cell.folded = !cell.folded;
                    }),
                  },
                }),
                BlurEditorInChiefEffect.of(),
              ],
            });
          }}
          className="drag-handle"
        />
        {children}

        <div style={{ minWidth: 20 }} data-can-start-selection />
      </ContextMenuWrapper>
    </CellContainer>
  );
};
