import React from "react";
import styled from "styled-components";
import { CodeMirror, Extension } from "codemirror-x-react";
import { StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Inspector } from "./Inspector";
import { compact, isEqual } from "lodash";

import { cell_keymap } from "./packages/codemirror-nexus/add-move-and-run-cells";
import { deserialize } from "./deserialize-value-to-show";

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
  CellTypeFacet,
  empty_cell,
  MoveCellEffect,
  MutateCellMetaEffect,
  RemoveCellEffect,
  ViewUpdate,
} from "./NotebookEditor";
import { basic_markdown_setup } from "./basic-markdown-setup";
import { StyleModule } from "style-mod";

let CellContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 1rem;

  will-change: transform;
`;

let InspectorHoverBackground = styled.div``;

let InspectorContainer = styled.div`
  padding-left: calc(16px + 4px);
  padding-right: 16px;
  overflow-y: auto;

  font-size: 16px;
  min-height: 24px;
`;

let CellHasSelectionPlugin = [
  EditorView.editorAttributes.of((view) => {
    let has_selection = view.state.field(CellHasSelectionField);
    return { class: has_selection ? "has-selection" : "" };
  }),
  EditorView.styleModule.of(
    new StyleModule({
      ".cm-editor:not(.has-selection) .cm-selectionBackground": {
        // Need to figure out what precedence I should give this thing so I don't need !important
        background: "none !important",
      },
    })
  ),
];

export let EditorStyled = styled.div`
  background-color: rgba(0, 0, 0, 0.4);
  margin-top: 8px;

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
      background-color: rgb(33 28 19);
    }
    & ${InspectorContainer} {
      transition: all 1s ease-in-out;
      opacity: 0.5;
      filter: blur(1px);
    }
  }

  &:not(.folded) {
    .cm-editor {
      border: solid 1px #ffffff14;
    }
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

let engine_cell_from_notebook_cell = (cell) => {
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
            onClick={() => {
              nexus_editorview.dispatch({
                effects: AddCellEffect.of({
                  index: 0,
                  cell: empty_cell(),
                }),
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
                  <Flipped flipId={cell.id}>
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
                      {nexus_editorview.state
                        .field(CellEditorStatesField)
                        .cells[cell.id].facet(CellTypeFacet) === "text" ? (
                        <TextCell
                          cell={cell}
                          viewupdate={viewupdate}
                          is_selected={selected_cells.includes(cell.id)}
                          did_just_get_created={last_created_cells.includes(
                            cell.id
                          )}
                        />
                      ) : (
                        <Cell
                          cell={cell}
                          viewupdate={viewupdate}
                          cylinder={engine.cylinders[cell.id]}
                          is_selected={selected_cells.includes(cell.id)}
                          did_just_get_created={last_created_cells.includes(
                            cell.id
                          )}
                        />
                      )}
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
                        nexus_editorview.dispatch({
                          effects: AddCellEffect.of({
                            index: my_index + 1,
                            cell: empty_cell(),
                          }),
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
                        nexus_editorview.dispatch({
                          effects: AddCellEffect.of({
                            index: my_index + 1,
                            cell: empty_cell("text"),
                          }),
                        });
                      },
                    },
                  ]}
                >
                  <AddButton
                    data-can-start-selection={false}
                    onClick={() => {
                      console.log("Hi");
                      let my_index = notebook.cell_order.indexOf(cell.id);
                      nexus_editorview.dispatch({
                        effects: AddCellEffect.of({
                          index: my_index + 1,
                          cell: empty_cell(),
                        }),
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
    let initial_editor_state = React.useRef(
      viewupdate.startState.field(CellEditorStatesField).cells[cell_id]
    ).current;

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
      for (let transaction of cell_transactions) {
        if (transaction.startState.facet(CellIdFacet) == cell_id) {
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
          // editorview.update([tr]);
          viewupdate.view.dispatch({
            effects: transactions.map((tr) =>
              CellDispatchEffect.of({
                cell_id: cell_id,
                transaction: tr,
              })
            ),
          });
        }}
      >
        {children}
      </CodeMirror>
    );
  }
);

/**
 * @param {{
 *  cell: import("./notebook-types").Cell,
 *  cylinder: import("./notebook-types").CylinderShadow,
 *  is_selected: boolean,
 *  did_just_get_created: boolean,
 *  viewupdate: ViewUpdate,
 * }} props
 */
export let Cell = ({
  cell,
  cylinder = engine_cell_from_notebook_cell(cell),
  is_selected,
  did_just_get_created,
  viewupdate,
}) => {
  // prettier-ignore
  let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));

  let result_deserialized = React.useMemo(() => {
    if (cylinder?.result?.type === "return") {
      return {
        type: cylinder.result.type,
        name: cylinder.result.name,
        value: deserialize(0, cylinder.result.value),
      };
    } else if (cylinder?.result?.type === "throw") {
      return {
        // Because observable inspector doesn't show the stack trace when it is a thrown value?
        // But we need to make our own custom error interface anyway (after we fix sourcemaps? Sighh)
        type: "return",
        value: deserialize(0, cylinder.result.value),
      };
    } else {
      return { type: "pending" };
    }
  }, [cylinder?.result]);

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  let cell_wrapper_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (did_just_get_created) {
      // TODO This should be in extensions some way
      editorview_ref.current.focus();
      cell_wrapper_ref.current.animate(
        [
          {
            clipPath: `inset(100% 0 0 0)`,
            transform: "translateY(-100%)",
            opacity: 0,
          },
          {
            clipPath: `inset(0 0 0 0)`,
            transform: "translateY(0%)",
            opacity: 1,
          },
        ],
        {
          duration: 200,
        }
      );
    }
  }, []);

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
        cell.folded && "folded",
        cell.unsaved_code !== cell.code && "modified",
        is_selected && "selected",
      ]).join(" ")}
    >
      <InspectorHoverBackground>
        <InspectorContainer>
          {result_deserialized.name && (
            <span>
              <span style={{ color: "#afb7d3", fontWeight: "700" }}>
                {result_deserialized.name}
              </span>
              <span>{" = "}</span>
            </span>
          )}
          <Inspector value={result_deserialized} />
        </InspectorContainer>
      </InspectorHoverBackground>

      <EditorStyled
        style={{
          height: cell.folded ? 0 : undefined,
          marginTop: cell.folded ? 0 : undefined,
        }}
      >
        <NestedCodemirror
          ref={editorview_ref}
          cell_id={cell.id}
          viewupdate={viewupdate}
        >
          <Extension
            key="basic-javascript-setup"
            extension={basic_javascript_setup}
          />
          <Extension key="cell_keymap" extension={cell_keymap} />

          <Extension extension={CellHasSelectionPlugin} key="oof" />

          {/* <Extension extension={codemirror_interactive} /> */}
          {/* <Extension extension={debug_syntax_plugin} /> */}
          {/* <Extension extension={inline_notebooks_extension} /> */}
          <Extension key="asd" extension={asd} />
        </NestedCodemirror>
      </EditorStyled>
    </CellStyle>
  );
};

let asd = [
  EditorView.domEventHandlers({
    focus: (view, event) => {
      // console.log(`FOCUS`, view, event);
    },
  }),
  EditorView.updateListener.of((update) => {}),
];

/**
 * @param {{
 *  cell: import("./notebook-types").Cell,
 *  is_selected: boolean,
 *  did_just_get_created: boolean,
 *  viewupdate: ViewUpdate,
 * }} props
 */
export let TextCell = ({
  cell,
  is_selected,
  did_just_get_created,
  viewupdate,
}) => {
  // prettier-ignore
  let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  let cell_wrapper_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (did_just_get_created) {
      // editorview_ref.current.focus();
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
      data-cell-id={cell.id}
      className={compact([
        cell.unsaved_code !== cell.code && "modified",
        is_selected && "selected",
      ]).join(" ")}
    >
      <NestedCodemirror
        ref={editorview_ref}
        cell_id={cell.id}
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

  --accent-color: rgba(200, 0, 0);
  accent-color: var(--accent-color);

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    display: inline-block;
  }
  h1 {
    font-size: 32px;

    .cm-line:has(&) {
      margin-top: 0.2em;
      margin-bottom: 0.3em;
    }
  }
  h2 {
    font-size: 24px;

    .cm-line:has(&) {
      margin-top: 0.2em;
      margin-bottom: 0.2em;
    }
  }
  h3 {
    font-size: 20px;

    .cm-line:has(&) {
      margin-top: 0.2em;
      margin-bottom: 0.1em;
    }
  }

  .header-mark {
    font-variant-numeric: tabular-nums;
    margin-left: calc(-1.8em - 5px);
    opacity: 0.3;
    font-size: 0.8em;
    display: inline-block;

    &.header-mark-h1 {
      margin-right: 5px;
      margin-left: calc(-1.8em - 6px);
    }
    &.header-mark-h2 {
      margin-right: 7px;
    }
    &.header-mark-h3 {
      margin-right: 9px;
    }
    &.header-mark-h4 {
      margin-right: 10px;
    }
    &.header-mark-h5 {
      margin-right: 11px;
    }
    &.header-mark-h6 {
      margin-right: 12px;
    }
  }

  .link-mark {
    opacity: 0.5;
  }
  .link-mark,
  .link-mark .link {
    color: white;
  }
  .link {
    color: var(--accent-color);
  }
  .url,
  .url .link {
    color: white;
    opacity: 0.5;
  }

  .cm-line.list-item:has(.list-mark) {
    margin-left: -1em;
  }
  .cm-line.order-list-item:has(.list-mark) {
    margin-left: -1em;
  }
  .cm-line.list-item:not(:has(.list-mark)) {
    /* Most likely need to tweak this for other em's */
    /* margin-left: 5px; */
  }
  .cm-line.list-item {
    margin-top: 0.3em;
    /* margin-bottom: 0.3em; */
  }
  .cm-line.list-item + .cm-line.list-item {
    margin-top: 0;
  }
  /* .cm-line.list-item:has(+ .cm-line.list-item) {
    margin-bottom: 0;
  } */

  .list-mark {
    color: transparent;
    width: 1em;
    display: inline-block;
  }
  .list-item:not(:has(.task-marker)) .list-mark::before {
    content: "-";
    position: absolute;
    /* top: 0; */
    transform: translateY(-4px);
    font-size: 1.2em;
    color: var(--accent-color);
  }
  .order-list-item:not(:has(.task-marker)) .list-mark::before {
    content: unset;
  }
  .order-list-item:not(:has(.task-marker)) .list-mark {
    color: var(--accent-color);
  }

  .task-marker {
    margin-left: -25px;
  }

  .hard-break::after {
    content: "⏎";
    color: rgba(255, 255, 255, 0.2);
  }
  .hr {
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    display: inline-block;
    width: 100%;
    vertical-align: middle;
  }

  /* .blockquote.cm-line {
    margin-left: -1em;
  } */
  .quote-mark {
    color: transparent;
    font-size: 0;
    display: inline-block;
    position: relative;
  }
  .blockquote {
    position: relative;
  }
  .blockquote::before {
    content: "";
    position: absolute;
    margin-left: 0.2em;
    pointer-events: none;
    font-size: 1.2em;
    background-color: rgba(200, 0, 0);
    width: 0.16em;
    top: 0;
    bottom: 0;
    left: -0.6em;
  }

  .emoji {
    color: var(--accent-color);
    font-style: italic;
  }

  .emphasis-mark {
    opacity: 0.5;
  }
  .strikethrough-mark {
    text-decoration: line-through;
    text-decoration-color: transparent;
    opacity: 0.5;
  }

  .strikethrough {
    text-decoration: line-through;
  }
  .emphasis {
    font-style: italic;
  }
  .strong-emphasis {
    font-weight: bold;
  }

  /* I apply this to the line because else the line will stay high, making
     the code look really fragile */
  .cm-line:has(.html) {
    font-size: 0.8em;
    color: #2fbf00;
  }
  .html-previous-toggle {
    position: absolute;
    transform: translateX(-100%) translateX(-10px) translateY(5px);
    font-size: 0.8em;
    color: #2fbf00;
    opacity: 0.5;
  }
  .html-previous-toggle:hover {
    opacity: 1;
    cursor: pointer;
  }

  .fenced-code {
  }
  .code-text {
    font-size: 0.9em;
    font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New",
      monospace;
  }
  .code-mark {
    opacity: 0.5;
  }
  .inline-code {
    font-size: 0.9em;
    outline: 1px solid #ffffff36;
    display: inline-block;
    padding: 0 5px;
    margin: 0 4px;
    border-radius: 2px;
  }
  /* .inline-code:first-child {
    margin-left: -5px;
  } */

  .cm-line.has-fenced-code {
    border: solid 1px #ffffff36;
    border-radius: 5px;
  }
  .cm-line.has-fenced-code + .cm-line.has-fenced-code {
    border-top: none;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }
  .cm-line.has-fenced-code:has(+ .cm-line.has-fenced-code) {
    border-bottom: none;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }

  /* Table */
  .table {
    color: white;
  }
  .cm-line:has(.table) {
    background-color: #ffffff0a;
  }
  .table-header {
    font-weight: bold;
  }
  .table-delimiter {
    opacity: 0.5;
  }

  .html-tag * {
    color: #2fbf00;
  }
  .comment-block {
    opacity: 0.5;
  }
  .processing-instruction-block {
    color: #2fbf00;
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
