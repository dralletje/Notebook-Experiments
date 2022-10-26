import React from "react";
import styled from "styled-components";
import { CodeMirror, Extension } from "codemirror-x-react";
import { StateField } from "@codemirror/state";
import { EditorView, placeholder, ViewPlugin } from "@codemirror/view";
import { compact, isEqual, range } from "lodash";
import { shallowEqualObjects } from "shallow-equal";

import { Inspector } from "./Inspector";
import { cell_keymap } from "./packages/codemirror-nexus/add-move-and-run-cells";

import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import { codemirror_interactive } from "./packages/codemirror-interactive/codemirror-interactive";

import { Flipper, Flipped } from "react-flip-toolkit";

import { IonIcon } from "@ionic/react";
import {
  codeOutline,
  eyeOutline,
  planetOutline,
  textOutline,
} from "ionicons/icons";

import { ContextMenuWrapper } from "./packages/react-contextmenu/react-contextmenu";
import { basic_javascript_setup } from "./codemirror-javascript-setup";
import { SelectedCellsField } from "./cell-selection";
import {
  AddCellEffect,
  CellDispatchEffect,
  CellEditorStatesField,
  CellHasSelectionField,
  CellIdFacet,
  CellMetaField,
  CellTypeFacet,
  empty_cell,
  MoveCellEffect,
  MutateCellMetaEffect,
  RemoveCellEffect,
  ViewUpdate,
} from "./NotebookEditor";
import { basic_markdown_setup } from "./basic-markdown-setup";

let CellContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 1rem;

  will-change: transform;
`;

let InspectorHoverBackground = styled.div``;

let InspectorContainer = styled.div`
  /* padding-left: calc(16px + 4px);
  padding-right: 16px; */
  overflow-y: auto;

  font-size: 16px;
  /* min-height: 24px; */

  .folded & {
    min-height: 24px;
  }
`;

// TODO Move to NotebookEditor
// .... (Should be part of multi-cell stuff)
let CellHasSelectionPlugin = [
  EditorView.editorAttributes.of((view) => {
    let has_selection = view.state.field(CellHasSelectionField);
    return { class: has_selection ? "has-selection" : "" };
  }),
  ViewPlugin.define((view) => {
    let has_selection = view.state.field(CellHasSelectionField);
    if (has_selection === true) {
      Promise.resolve().then(() => {
        // Make sure the editor isn't removed yet :O
        if (view.dom.isConnected) {
          view.focus();
        }
      });
    }

    return {
      update: (update) => {
        let had_selection = update.startState.field(CellHasSelectionField);
        let needs_selection = update.state.field(CellHasSelectionField);
        if (had_selection !== needs_selection) {
          let has_focus = view.dom.contains(document.activeElement);
          if (has_focus === needs_selection) return;

          if (needs_selection) {
            update.view.focus();
          } else {
            update.view.dom.blur();
          }
        }
      },
    };
  }),
  EditorView.theme({
    ".cm-editor:not(.has-selection) .cm-selectionBackground": {
      // Need to figure out what precedence I should give this thing so I don't need !important
      background: "none !important",
    },
  }),
];

let NOISE_BACKGROUND = new URL("./noise-background.png", import.meta.url).href;
export let EditorStyled = styled.div`
  /* background-color: rgba(0, 0, 0, 0.4); */
  background-color: rgb(42 0 130 / 40%);
  background-image: url(${NOISE_BACKGROUND});

  & .cm-content {
    padding: 16px !important;
  }
`;

let CellStyle = styled.div`
  flex: 1 1 0px;
  min-width: 0px;

  /* background-color: rgba(0, 0, 0, 0.4); */
  /* I like transparency better for when the backdrop color changes
     but it isn't great when dragging */
  background-color: #121212;

  font-family: Menlo, "Roboto Mono", "Lucida Sans Typewriter", "Source Code Pro",
    monospace;

  & ${InspectorContainer} {
    transition: all 0.2s ease-in-out;
  }
  &.modified {
    & ${EditorStyled} {
      background-color: rgb(24 21 15);
    }
    & ${InspectorContainer} {
      transition: all 1s ease-in-out;
      /* opacity: 0.3; */
    }
  }

  &:not(.folded) {
    .cm-editor {
      border: solid 1px #ffffff14;
    }
  }

  &.force-unfolded .cell-editor {
    opacity: 0.7;
  }

  position: relative;
  &::before {
    content: "";
    pointer-events: none;
    position: absolute;
    left: -10px;
    right: 100%;
    top: 0;
    bottom: 0;
  }

  &.pending::before {
    background-color: #4a4a4a;
  }
  &.error::before {
    background-color: #820209;
  }
  &.running::before {
    background-color: white;
  }

  &.selected::after {
    content: "";
    position: absolute;
    inset: -0.5rem;
    left: -1rem;
    background-color: #20a5ba24;
    pointer-events: none;
  }

  border-radius: 3px;
  /* box-shadow: rgba(255, 255, 255, 0) 0px 0px 20px; */
  filter: drop-shadow(0 0px 0px rgba(255, 255, 255, 0));
  transform: scaleX(1);
  transform-origin: top left;

  transition: filter 0.2s ease-in-out, transform 0.2s ease-in-out;

  & ${InspectorHoverBackground} {
    position: relative;

    &::after {
      content: "";
      position: absolute;
      inset: -8px 0 -8px 0;
      background-color: #001c21;
      z-index: -1;
      pointer-events: none;

      transition: opacity 0.2s ease-in-out;
      opacity: 0;
    }
  }

  .dragging &,
  ${CellContainer}:has(.drag-handle:hover) &,
  ${CellContainer}:has(.menu:focus) & {
    /* box-shadow: rgba(255, 255, 255, 0.1) 0px 0px 20px; */
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.1));
    /* transform: scaleX(1.05); */
    transform: translateX(-2px) translateY(-2px);
    z-index: 1;

    & ${InspectorHoverBackground}::after {
      opacity: 1;
    }
  }
  .dragging & {
    --prexisting-transform: translateX(-2px) translateY(-2px);
    animation: shake 0.2s ease-in-out infinite alternate;
  }
`;

let engine_cell_from_notebook_cell = () => {
  return {
    last_run: -Infinity,
    result: null,
    running: false,
    waiting: false,
  };
};

let DragAndDropListStyle = styled.div`
  display: flex;
  flex-direction: column;
`;

let DragAndDropList = ({ children, nexus_editorview, cell_order }) => {
  return (
    <DragDropContext
      onDragEnd={({ draggableId, destination, source }) => {
        if (destination) {
          nexus_editorview.dispatch({
            effects: MoveCellEffect.of({
              cell_id: draggableId,
              from: source.index,
              to: destination.index,
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

export let LastCreatedCells = StateField.define({
  create() {
    return /** @type {import("./notebook-types").CellId[]} */ ([]);
  },
  update(value, tr) {
    let previous_cell_ids = Object.keys(
      tr.startState.field(CellEditorStatesField).cells
    );
    let cell_ids = Object.keys(tr.state.field(CellEditorStatesField).cells);
    if (isEqual(previous_cell_ids, cell_ids)) return value;
    let new_cell_ids = cell_ids.filter((id) => !previous_cell_ids.includes(id));
    return new_cell_ids;
  },
});

/**
 * @param {{
 *  notebook: import("./notebook-types").Notebook,
 *  engine: import("./notebook-types").EngineShadow,
 *  viewupdate: import("./NotebookEditor").ViewUpdate,
 * }} props
 */
export let CellList = ({ notebook, engine, viewupdate }) => {
  let nexus_editorview = viewupdate.view;

  /**
   * Keep track of what cells are just created by the users,
   * so we can animate them in 🤩
   */
  let last_created_cells =
    nexus_editorview.state.field(LastCreatedCells, false) ?? [];

  let selected_cells = nexus_editorview.state.field(SelectedCellsField);

  return (
    <React.Fragment>
      <DragAndDropList
        cell_order={notebook.cell_order}
        nexus_editorview={nexus_editorview}
      >
        <div
          style={{
            height: 0,
            position: "relative",
          }}
        >
          <AddButton
            data-can-start-selection={false}
            onClick={() => {
              let new_cell = empty_cell();
              nexus_editorview.dispatch({
                effects: [
                  AddCellEffect.of({
                    index: 0,
                    cell: new_cell,
                  }),
                  CellDispatchEffect.of({
                    cell_id: new_cell.id,
                    transaction: { selection: { anchor: 0 } },
                  }),
                ],
              });
            }}
          >
            + <span className="show-me-later">add cell</span>
          </AddButton>
        </div>

        {notebook.cell_order
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
                        options={[
                          {
                            title: (
                              <ContextMenuItem
                                icon={<IonIcon icon={planetOutline} />}
                                label="Delete"
                                shortcut="⌘K"
                              />
                            ),
                            onClick: () => {
                              nexus_editorview.dispatch({
                                effects: [
                                  RemoveCellEffect.of({ cell_id: cell.id }),
                                ],
                              });
                            },
                          },
                          {
                            title: (
                              <ContextMenuItem
                                icon={<IonIcon icon={eyeOutline} />}
                                label="Fold"
                              />
                            ),
                            onClick: () => {
                              nexus_editorview.dispatch({
                                effects: CellDispatchEffect.of({
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
                        ]}
                      >
                        <div
                          style={{
                            minWidth: 30,
                          }}
                          {...provided.dragHandleProps}
                          onClick={() => {
                            nexus_editorview.dispatch({
                              effects: CellDispatchEffect.of({
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
                        {nexus_editorview.state
                          .field(CellEditorStatesField)
                          .cells[cell.id].facet(CellTypeFacet) === "text" ? (
                          <TextCellMemo
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
              <div
                style={{
                  height: 0,
                  position: "relative",
                }}
              >
                <ContextMenuWrapper
                  options={[
                    {
                      title: (
                        <ContextMenuItem
                          icon={<IonIcon icon={codeOutline} />}
                          label="Add Code Cell"
                          shortcut="⌘K"
                        />
                      ),
                      onClick: () => {
                        let my_index = notebook.cell_order.indexOf(cell.id);
                        let new_cell = empty_cell();
                        nexus_editorview.dispatch({
                          effects: [
                            AddCellEffect.of({
                              index: my_index + 1,
                              cell: new_cell,
                            }),
                            CellDispatchEffect.of({
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
                          label="Add Text Cell"
                        />
                      ),
                      onClick: () => {
                        let my_index = notebook.cell_order.indexOf(cell.id);
                        let new_cell = empty_cell("text");
                        nexus_editorview.dispatch({
                          effects: [
                            AddCellEffect.of({
                              index: my_index + 1,
                              cell: new_cell,
                            }),
                            CellDispatchEffect.of({
                              cell_id: new_cell.id,
                              transaction: { selection: { anchor: 0 } },
                            }),
                          ],
                        });
                      },
                    },
                  ]}
                >
                  <AddButton
                    data-can-start-selection={false}
                    onClick={() => {
                      let my_index = notebook.cell_order.indexOf(cell.id);
                      let new_cell = empty_cell();
                      nexus_editorview.dispatch({
                        effects: [
                          AddCellEffect.of({
                            index: my_index + 1,
                            cell: new_cell,
                          }),
                          CellDispatchEffect.of({
                            cell_id: new_cell.id,
                            transaction: { selection: { anchor: 0 } },
                          }),
                        ],
                      });
                    }}
                  >
                    + <span className="show-me-later">add cell</span>
                  </AddButton>
                </ContextMenuWrapper>
              </div>
            </React.Fragment>
          ))}
      </DragAndDropList>
    </React.Fragment>
  );
};

// TODO Should be part of NotebookEditor
export let NestedCodemirror = React.forwardRef(
  (
    /** @type {{ viewupdate: ViewUpdate, cell_id: import("./notebook-types").CellId, children: React.ReactNode }} */ {
      viewupdate,
      cell_id,
      children,
    },
    /** @type {import("react").ForwardedRef<EditorView>} */ _ref
  ) => {
    let initial_editor_state = React.useMemo(() => {
      return viewupdate.startState.field(CellEditorStatesField).cells[cell_id];
    }, []);

    // prettier-ignore
    let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));
    React.useImperativeHandle(_ref, () => editorview_ref.current);

    // prettier-ignore
    let last_viewupdate_ref = React.useRef(/** @type {ViewUpdate} */ (/** @type {any} */ (null)));
    React.useLayoutEffect(() => {
      // Make sure we don't update from the same viewupdate twice
      if (last_viewupdate_ref.current === viewupdate) {
        return;
      }
      last_viewupdate_ref.current = viewupdate;

      // Because we get one `viewupdate` for multiple transactions happening,
      // and `.transactions_to_send_to_cells` gets cleared after every transactions,
      // we have to go over all the transactions in the `viewupdate` and collect `.transactions_to_send_to_cells`s.
      let cell_transactions = viewupdate.transactions.flatMap((transaction) => {
        return transaction.state.field(CellEditorStatesField)
          .transactions_to_send_to_cells;
      });

      let transaction_for_this_cell = [];
      let current_state = editorview_ref.current.state;
      for (let transaction of cell_transactions) {
        if (transaction.startState.facet(CellIdFacet) == cell_id) {
          if (transaction.startState !== current_state) {
            continue;
          }

          current_state = transaction.state;
          transaction_for_this_cell.push(transaction);
        }
      }
      if (transaction_for_this_cell.length > 0) {
        editorview_ref.current.update(transaction_for_this_cell);
      }
    }, [viewupdate]);

    return (
      <CodeMirror
        state={initial_editor_state}
        ref={editorview_ref}
        dispatch={(transactions, editorview) => {
          // viewupdate.view.dispatch({
          //   effects: transactions.map((tr) =>
          //     CellDispatchEffect.of({
          //       cell_id: cell_id,
          //       transaction: tr,
          //     })
          //   ),
          // });
          viewupdate.view.dispatch(
            ...transactions.map((tr) => ({
              annotations: tr.annotations,
              effects: CellDispatchEffect.of({
                cell_id: cell_id,
                transaction: tr,
              }),
            }))
          );
        }}
      >
        {children}
      </CodeMirror>
    );
  }
);

/** @param {Selection | null} selection */
function* ranges(selection) {
  if (selection === null) return;
  for (let index of range(0, selection.rangeCount)) {
    yield selection.getRangeAt(index);
  }
}
// Been scratching my head over this,
// but there is a difference between `focus` and `selection` it turns out...
// So as an experiment I now remove the selections in the editor when the editor loses focus.
// TODO Add this to the text editor as well
// TODO Make this a "default" behavior for the editor? Maybe even add to CodeMirror?
let remove_selection_on_blur_extension = EditorView.domEventHandlers({
  blur: (event, view) => {
    let selection = document.getSelection();
    for (let selection_range of ranges(selection)) {
      if (
        view.dom.contains(selection_range.startContainer) ||
        view.dom.contains(selection_range.endContainer)
      ) {
        selection?.removeRange(selection_range);
      }
    }
  },
});

/**
 * @param {{
 *  cell_id: import("./notebook-types").CellId,
 *  cylinder: import("./notebook-types").CylinderShadow,
 *  is_selected: boolean,
 *  did_just_get_created: boolean,
 *  viewupdate: ViewUpdate,
 * }} props
 */
export let Cell = ({
  cell_id,
  cylinder = engine_cell_from_notebook_cell(),
  is_selected,
  did_just_get_created,
  viewupdate,
}) => {
  let state = viewupdate.state.field(CellEditorStatesField).cells[cell_id];
  let type = state.facet(CellTypeFacet);
  let cell = {
    id: cell_id,
    unsaved_code: state.doc.toString(),
    ...state.field(CellMetaField),
    type: type,

    // Uhhhh TODO??
    ...(type === "text" ? { code: state.doc.toString() } : {}),
  };

  // prettier-ignore
  let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  let cell_wrapper_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (did_just_get_created) {
      cell_wrapper_ref.current.animate(
        [
          {
            clipPath: `inset(100% 0 0 0)`,
            transform: "translateY(-100%)",
            // opacity: 0,
          },
          {
            clipPath: `inset(0 0 0 0)`,
            transform: "translateY(0%)",
            // opacity: 1,
          },
        ],
        {
          duration: 200,
        }
      );
    }
  }, []);

  let [is_focused, set_is_focused] = React.useState(false);
  let set_is_focused_extension = React.useMemo(() => {
    return EditorView.domEventHandlers({
      focus: () => {
        set_is_focused(true);
      },
      blur: (event, view) => {
        set_is_focused(false);
      },
    });
  }, [set_is_focused]);

  // NOTE Can also use CellHasSelectionField, but that will keep the cell open
  // .... when I click somewhere else... but it now closes abruptly... hmmmm
  // let folded = state.field(CellHasSelectionField) ? false : cell.folded;
  let folded = is_focused ? false : cell.folded;
  let forced_unfolded = cell.folded && is_focused;

  return (
    <CellStyle
      ref={cell_wrapper_ref}
      data-cell-id={cell.id}
      className={compact([
        cylinder.running && "running",
        (cylinder.waiting ||
          (cylinder.last_run ?? -Infinity) < (cell.last_run ?? -Infinity)) &&
          "pending",
        cylinder.result?.type === "throw" && "error",
        cylinder.result?.type === "return" && "success",
        folded && "folded",
        forced_unfolded && "force-unfolded",
        cell.unsaved_code !== cell.code && "modified",
        is_selected && "selected",
      ]).join(" ")}
    >
      <InspectorHoverBackground>
        <InspectorContainer>
          <Inspector value={cylinder?.result} />
        </InspectorContainer>
      </InspectorHoverBackground>

      <EditorStyled
        className="cell-editor"
        style={{
          height: folded ? 0 : undefined,
          marginTop: folded ? 0 : undefined,
        }}
      >
        <NestedCodemirror
          ref={editorview_ref}
          cell_id={cell.id}
          viewupdate={viewupdate}
        >
          <Extension
            key="placeholder"
            deps={[]}
            extension={placeholder("The rest is still unwritten...")}
          />
          <Extension
            key="basic-javascript-setup"
            extension={basic_javascript_setup}
          />
          <Extension key="cell_keymap" extension={cell_keymap} />

          <Extension key="oof" extension={CellHasSelectionPlugin} />
          <Extension
            key="set_is_focused_extension"
            extension={set_is_focused_extension}
          />
          <Extension
            key="remove_selection_on_blur_extension"
            extension={remove_selection_on_blur_extension}
          />
          {/* <Extension extension={codemirror_interactive} /> */}
          <Extension extension={debug_syntax_plugin} />
          {/* <Extension extension={inline_notebooks_extension} /> */}
        </NestedCodemirror>
      </EditorStyled>
    </CellStyle>
  );
};

// Not sure if this is useful at all, as the `Cell` is a very small component at the moment...
let CellMemo = React.memo(
  Cell,
  (
    {
      viewupdate: old_viewupdate,
      cylinder: old_cylinder,
      cell_id: old_cell_id,
      ...old_props
    },
    { viewupdate: next_viewupdate, cylinder, cell_id, ...next_props }
  ) => {
    return (
      shallowEqualObjects(old_props, next_props) &&
      old_viewupdate.state.field(CellEditorStatesField).cells[cell_id] ===
        next_viewupdate.state.field(CellEditorStatesField).cells[cell_id] &&
      isEqual(old_cylinder, cylinder)
    );
  }
);

/**
 * @param {{
 *  cell_id: import("./notebook-types").CellId,
 *  cell: import("./notebook-types").Cell,
 *  is_selected: boolean,
 *  did_just_get_created: boolean,
 *  viewupdate: ViewUpdate,
 * }} props
 */
let TextCell = ({ cell_id, is_selected, did_just_get_created, viewupdate }) => {
  // prettier-ignore
  let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  let cell_wrapper_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (did_just_get_created) {
      cell_wrapper_ref.current.animate(
        [
          {
            clipPath: `inset(100% 0 0 0)`,
            transform: "translateY(-100%)",
          },
          {
            clipPath: `inset(0 0 0 0)`,
            transform: "translateY(0%)",
          },
        ],
        {
          duration: 200,
        }
      );
    }
  }, []);

  return (
    <TextCellStyle
      ref={cell_wrapper_ref}
      data-cell-id={cell_id}
      className={compact([is_selected && "selected", "cell-editor"]).join(" ")}
    >
      <NestedCodemirror
        ref={editorview_ref}
        cell_id={cell_id}
        viewupdate={viewupdate}
      >
        <Extension key="markdown-setup" extension={basic_markdown_setup} />
        {/* <Extension extension={debug_syntax_plugin} /> */}
        <Extension extension={CellHasSelectionPlugin} key="oof" />
        <Extension key="cell_keymap" extension={cell_keymap} />
      </NestedCodemirror>
    </TextCellStyle>
  );
};

// Idk
let TextCellMemo = React.memo(
  TextCell,
  (
    { viewupdate: old_viewupdate, cell_id: old_cell_id, ...old_props },
    { viewupdate: next_viewupdate, cell_id, ...next_props }
  ) => {
    return (
      shallowEqualObjects(old_props, next_props) &&
      old_viewupdate.state.field(CellEditorStatesField).cells[cell_id] ===
        next_viewupdate.state.field(CellEditorStatesField).cells[cell_id]
    );
  }
);

let TextCellStyle = styled.div`
  flex: 1 1 0px;
  min-width: 0px;

  font-family: system-ui;
  font-size: 1.2em;

  position: relative;

  padding-left: 16px;

  &.selected::after {
    content: "";
    position: absolute;
    inset: -0.5rem;
    left: -1rem;
    background-color: #20a5ba24;
    pointer-events: none;
  }

  .cm-scroller {
    overflow: visible;
  }

  border-radius: 3px;
  /* box-shadow: rgba(255, 255, 255, 0) 0px 0px 20px; */
  filter: drop-shadow(0 0px 0px rgba(255, 255, 255, 0));
  transform: scaleX(1);
  transform-origin: top left;

  transition: filter 0.2s ease-in-out, transform 0.2s ease-in-out;

  .dragging &,
  ${CellContainer}:has(.drag-handle:hover) &,
  ${CellContainer}:has(.menu:focus) & {
    /* box-shadow: rgba(255, 255, 255, 0.1) 0px 0px 20px; */
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.1));
    /* transform: scaleX(1.05); */
    transform: translateX(-2px) translateY(-2px);
    z-index: 1;
  }
  .dragging & {
    --prexisting-transform: translateX(-2px) translateY(-2px);
    animation: shake 0.2s ease-in-out infinite alternate;
  }
`;

let AddButton = styled.button`
  position: absolute;
  top: calc(100% - 1rem);
  transform: translateY(-25%);
  z-index: 1000;
  left: calc(100% - 20px);
  color: #ffffff82;
  border: none;
  white-space: pre;

  display: flex;
  flex-direction: row;
  align-items: center;

  opacity: 0;
  transition: opacity 0.2s ease-in-out;

  .cell-container:focus-within + div &,
  .cell-container:hover + div &,
  div:hover > &,
  div:has(+ .cell-container:hover) &,
  div:has(+ .cell-container:focus-within) & {
    opacity: 1;
  }

  & .show-me-later {
    display: none;
    font-size: 0.8rem;
  }
  &:hover .show-me-later,
  dialog[open] + div > & > .show-me-later {
    display: inline;
  }
  /* Hehe */
  dialog[open] + div > & {
    background-color: white;
    color: black;
  }
`;
