import React from "react";
import styled from "styled-components";
import { GenericViewUpdate } from "codemirror-x-react/viewupdate.js";

import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

import { Flipper, Flipped } from "react-flip-toolkit";

import { IonIcon } from "@ionic/react";
import {
  codeOutline,
  eyeOutline,
  planetOutline,
  textOutline,
} from "ionicons/icons";

import { ContextMenuWrapper } from "./packages/react-contextmenu/react-contextmenu";
import { SelectedCellsField } from "./packages/codemirror-notebook/cell-selection";
import {
  CellAddEffect,
  EditorDispatchEffect,
  CellRemoveEffect,
  EditorInChief,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
  MutateCellMetaEffect,
  empty_cell,
} from "./packages/codemirror-notebook/cell";
import { create_cell_state } from "./App.jsx";
import {
  CellOrderEffect,
  CellOrderField,
} from "./packages/codemirror-notebook/cell-order.js";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";
import { CellMemo } from "./Cell.jsx";
import { TextCell } from "./TextCell.jsx";

let CellContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 0.5rem;

  will-change: transform;
`;

export let EditorStyled = styled.div`
  /* background-color: rgba(0, 0, 0, 0.4); */
  /* background-color: rgb(23 23 23 / 40%); */
  background-color: #141414;
  & .cm-content {
    padding: 16px !important;
  }
`;

let DragAndDropListStyle = styled.div`
  display: flex;
  flex-direction: column;
`;

let DragAndDropList = ({ children, editor_in_chief, cell_order }) => {
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
              <div data-can-start-cell-selection>{children}</div>
            </Flipper>
            {provided.placeholder}
          </DragAndDropListStyle>
        )}
      </Droppable>
    </DragDropContext>
  );
};

/**
 * @param {{
 *  icon: import("react").ReactElement,
 *  label: string,
 *  shortcut?: string,
 * }} props
 */
let ContextMenuItem = ({ icon, label, shortcut }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        whiteSpace: "pre",
      }}
    >
      <span style={{ flex: "0 1 content", transform: "translateY(2px)" }}>
        {icon}
      </span>
      <div style={{ minWidth: 8 }} />
      <span>{label}</span>
      <div style={{ flex: "1 0 40px" }} />
      {shortcut && (
        <div style={{ opacity: 0.5, fontSize: "0.8em" }}>{shortcut}</div>
      )}
    </div>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          Error
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * @param {{
 *  editor_in_chief: import("codemirror-x-react/viewupdate.js").EditorView<EditorInChief>,
 *  cell: import("./notebook-types.js").Cell,
 * }} props
 */
let cell_actions = ({ editor_in_chief, cell }) => [
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
          CellAddEffect.of({
            cell_id: new_cell.id,
            state: create_cell_state(editor_in_chief.state, new_cell),
          }),
          CellOrderEffect.of({
            cell_id: new_cell.id,
            index: my_index + 1,
          }),
          EditorDispatchEffect.of({
            cell_id: new_cell.id,
            transaction: { selection: { anchor: 0 } },
          }),
        ],
      });
    },
  },
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
          CellAddEffect.of({
            cell_id: new_cell.id,
            state: create_cell_state(editor_in_chief.state, new_cell),
          }),
          CellOrderEffect.of({
            cell_id: new_cell.id,
            index: my_index,
          }),
          EditorDispatchEffect.of({
            cell_id: new_cell.id,
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
          CellRemoveEffect.of({ cell_id: cell.id }),
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
          cell_id: cell.id,
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

/**
 * @param {{
 *  notebook: import("./notebook-types").Notebook,
 *  engine: import("./notebook-types").EngineShadow,
 *  viewupdate: GenericViewUpdate<EditorInChief>,
 * }} props
 */
export let CellList = ({ notebook, engine, viewupdate }) => {
  let editor_in_chief = viewupdate.view;

  /**
   * Keep track of what cells are just created by the users,
   * so we can animate them in 🤩
   */
  let last_created_cells =
    editor_in_chief.state.field(LastCreatedCells, false) ?? [];

  let selected_cells = editor_in_chief.state.field(SelectedCellsField);
  let cell_order = editor_in_chief.state.field(CellOrderField);

  return (
    <React.Fragment>
      <DragAndDropList
        cell_order={cell_order}
        editor_in_chief={editor_in_chief}
      >
        {cell_order
          .map((cell_id) => notebook.cells[cell_id])
          .map((cell, index) => (
            <React.Fragment key={cell.id}>
              <Draggable draggableId={cell.id} index={index}>
                {(provided, snapshot) => (
                  <Flipped
                    translate
                    // Scale animation screws with codemirrors cursor calculations :/
                    scale={false}
                    flipId={cell.id}
                  >
                    <CellContainer
                      data-can-start-selection={false}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={
                        (snapshot.isDragging && !snapshot.dropAnimation
                          ? "dragging"
                          : "") + " cell-container"
                      }
                    >
                      <ContextMenuWrapper
                        options={cell_actions({ editor_in_chief, cell })}
                      >
                        <div
                          style={{
                            minWidth: 30,
                          }}
                          {...provided.dragHandleProps}
                          onClick={() => {
                            editor_in_chief.dispatch({
                              effects: EditorDispatchEffect.of({
                                cell_id: cell.id,
                                transaction: {
                                  effects: MutateCellMetaEffect.of((cell) => {
                                    cell.folded = !cell.folded;
                                  }),
                                },
                              }),
                            });
                          }}
                          className="drag-handle"
                        />
                      </ContextMenuWrapper>

                      <ErrorBoundary>
                        {editor_in_chief.state
                          .editor(cell.id)
                          .facet(CellTypeFacet) === "text" ? (
                          <TextCell
                            cell={cell}
                            viewupdate={viewupdate}
                            is_selected={selected_cells.includes(cell.id)}
                            cell_id={cell.id}
                            did_just_get_created={last_created_cells.includes(
                              cell.id
                            )}
                          />
                        ) : (
                          <CellMemo
                            viewupdate={viewupdate}
                            cylinder={engine.cylinders[cell.id]}
                            is_selected={selected_cells.includes(cell.id)}
                            cell_id={cell.id}
                            did_just_get_created={last_created_cells.includes(
                              cell.id
                            )}
                          />
                        )}
                      </ErrorBoundary>
                    </CellContainer>
                  </Flipped>
                )}
              </Draggable>
            </React.Fragment>
          ))}
      </DragAndDropList>
    </React.Fragment>
  );
};
