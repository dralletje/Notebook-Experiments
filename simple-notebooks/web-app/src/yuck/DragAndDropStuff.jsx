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
    <DragDropContext
      onDragEnd={({ draggableId, destination, source }) => {
        if (destination) {
          editor_in_chief.dispatch({
            effects: CellOrderEffect.of({
              cell_id: draggableId,
              // from: source.index,
              index: destination.index,
            }),
          });
        }
      }}
    >
      <Droppable droppableId="cells">
        {(provided) => (
          <DragAndDropListStyle
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            <Flipper flipKey={cell_order.join(",")} spring={"stiff"}>
              <div data-can-start-cell-selection className="flex flex-col">
                {children}
              </div>
            </Flipper>
            {provided.placeholder}
          </DragAndDropListStyle>
        )}
      </Droppable>
    </DragDropContext>
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
 *  context_options: any[]
 * }} props
 */
export let DragAndDropItem = ({
  children,
  cell_id,
  index,
  editor_in_chief,
  context_options,
}) => {
  let cell_type = editor_in_chief.state.editor(cell_id).facet(CellTypeFacet);
  return (
    <Draggable draggableId={cell_id} index={index}>
      {(provided, snapshot) => (
        <Flipped
          translate
          // Scale animation screws with codemirrors cursor calculations :/
          scale={false}
          flipId={cell_id}
        >
          <CellContainer
            data-can-start-selection={false}
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={compact([
              snapshot.isDragging && !snapshot.dropAnimation
                ? "dragging"
                : null,
              "cell-container",
              `cell-${cell_type}`,
            ]).join(" ")}
          >
            <ContextMenuWrapper options={context_options}>
              <div
                style={{ minWidth: 50 }}
                {...provided.dragHandleProps}
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
            </ContextMenuWrapper>

            {children}
          </CellContainer>
        </Flipped>
      )}
    </Draggable>
  );
};
