import React from "react";
import { mutate, mutator } from "use-immer-store";
import styled, { keyframes } from "styled-components";
import { CodeMirror, Extension, useEditorView } from "codemirror-x-react";
import {
  Compartment,
  EditorSelection,
  Facet,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { EditorView, keymap, runScopeHandlers } from "@codemirror/view";
import { Inspector } from "./Inspector";
import { compact, debounce, intersection, without } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import {
  CellIdFacet,
  child_extension,
  codemirror_nexus,
  from_cell_effects,
  NexusFacet,
  nexus_extension,
  ToCellEffect,
} from "./packages/codemirror-nexus/codemirror-nexus";
import {
  cell_movement_extension,
  CellIdOrder,
} from "./packages/codemirror-nexus/codemirror-cell-movement";
import {
  BlurEffect,
  blur_when_other_cell_focus,
} from "./packages/codemirror-nexus/codemirror-blur-when-other-cell-focus";
import {
  historyKeymap,
  shared_history,
} from "./packages/codemirror-nexus/codemirror-shared-history";
import { SelectionArea } from "./selection-area/SelectionArea";
import {
  AddCellEffect,
  cell_keymap,
  empty_cell,
  MoveCellEffect,
  NotebookFacet,
  notebook_in_nexus,
  RemoveCellEffect,
  RunIfChangedCellEffect,
} from "./packages/codemirror-nexus/add-move-and-run-cells";
import { deserialize } from "./deserialize-value-to-show";

import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import { codemirror_interactive } from "./packages/codemirror-interactive/codemirror-interactive";

import { Flipper, Flipped } from "react-flip-toolkit";

import { IonIcon } from "@ionic/react";
import { eyeOutline, planetOutline } from "ionicons/icons";

import {
  create_worker,
  post_message,
} from "./packages/typescript-server-webworker/typescript-server-webworker";
import { ContextMenuWrapper } from "./packages/react-contextmenu/react-contextmenu";
import { basic_javascript_setup } from "./codemirror-javascript-setup";

let CellContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 1rem;
`;

let InspectorContainer = styled.div`
  font-size: 16px;
  min-height: 24px;
`;

let InspectorInnerContainer = styled.div`
  padding-left: calc(16px + 4px);
  padding-right: 16px;
  overflow-y: auto;
`;

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

  & ${InspectorInnerContainer} {
    transition: all 1s ease-in-out;
  }
  &.modified {
    & ${EditorStyled} {
      background-color: rgb(33 28 19);
    }
    & ${InspectorInnerContainer} {
      opacity: 0.5;
      filter: blur(1px);
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

  & ${InspectorContainer} {
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

    & ${InspectorContainer}::after {
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
            <Flipper
              flipKey={cell_order.join(",")}
              spring={"stiff"}
              data-can-start-cell-selection
            >
              <div data-can-start-cell-selection>{children}</div>
            </Flipper>
            {provided.placeholder}
          </DragAndDropListStyle>
        )}
      </Droppable>
    </DragDropContext>
  );
};

let useCodemirrorExtension = (editorview, extension) => {
  let compartment = React.useRef(new Compartment()).current;
  React.useLayoutEffect(() => {
    editorview.dispatch({
      effects: StateEffect.appendConfig.of(compartment.of(extension)),
    });
    return () => {
      editorview.dispatch({
        // @ts-ignore
        effects: compartment.reconfigure(null),
      });
    };
  }, []);
  React.useLayoutEffect(() => {
    editorview.dispatch?.({
      effects: compartment.reconfigure(extension),
    });
  }, [extension]);
};

let CellEditorSelection = StateField.define({
  create() {
    return /** @type {null | { cell_id: import("./App").CellId, selection: EditorSelection }} */ (
      null
    );
  },
  update(value, tr) {
    for (let {
      value: { cell_id, transaction },
    } of from_cell_effects(tr)) {
      if (transaction.selection || transaction.docChanged) {
        value = { cell_id, selection: transaction.newSelection };
      }
    }
    return value;
  },
});

/**
 * @typedef CellAndCodeMap
 * @type {{
 *  code: string,
 *  cell_map: {
 *    [cell_id: string]: {
 *      start: number,
 *      end: number,
 *    }
 *  }
 * }}
 */

/** @type {Facet<CellAndCodeMap, CellAndCodeMap>} */
let CodeAndCellMapFacet = Facet.define({
  combine: (values) => values[0],
});

/**
 * @param {{
 *  notebook: import("./App").Notebook,
 *  engine: import("./App").EngineShadow,
 * }} props
 */
export let CellList = ({ notebook, engine }) => {
  let [_selected_cells, set_selected_cells] = React.useState(
    /** @type {import("./App").CellId[]} */ ([])
  );
  // Just making sure the rest of the app only sees existing cells in `selected_cells`
  let selected_cells = intersection(_selected_cells, notebook.cell_order);

  // I'm adding `cell_id_order_compartment` here manually (and at construction time) vs. using `useCodemirrorExtension`
  // because else the compartment will only be added after all the extensions from children are added,
  // and they won't have CellIdOrder yet, making things harder...
  // TODO Maybe I need to add the compartment at render time? idk, need componentWillMount 🥲
  let notebook_compartment = React.useRef(new Compartment()).current;
  let nexus_editorview = React.useMemo(
    () =>
      codemirror_nexus([
        notebook_compartment.of(NotebookFacet.of(notebook)),
        CellIdOrder.compute(
          [NotebookFacet],
          (state) => state.facet(NotebookFacet).cell_order
        ),
      ]),
    [codemirror_nexus, notebook_compartment]
  );
  React.useLayoutEffect(() => {
    nexus_editorview.dispatch?.({
      effects: notebook_compartment.reconfigure(NotebookFacet.of(notebook)),
    });
  }, [nexus_editorview, notebook]);

  // Keymap that interacts with the selected cells
  // TODO Maybe add these to codemirror state too??
  useCodemirrorExtension(
    nexus_editorview,
    React.useMemo(() => {
      return keymap.of([
        {
          key: "Backspace",
          run: ({ state, dispatch }) => {
            // Remove cell
            dispatch({
              effects: selected_cells.map((cell_id) =>
                RemoveCellEffect.of({ cell_id: cell_id })
              ),
            });
            return true;
          },
        },
        {
          key: "Mod-a",
          run: ({ state, dispatch }) => {
            // Select all cells
            set_selected_cells(notebook.cell_order);
            return true;
          },
        },
      ]);
    }, [selected_cells])
  );
  // Remove focus from cell editors when selecting any whole cell
  React.useLayoutEffect(() => {
    if (selected_cells.length > 0) {
      nexus_editorview.dispatch?.({
        effects: notebook.cell_order.map((cell_id) =>
          ToCellEffect.of({
            cell_id: cell_id,
            transaction_spec: {
              effects: BlurEffect.of(),
            },
          })
        ),
      });
    }
  }, [selected_cells, notebook.cell_order]);

  useCodemirrorExtension(nexus_editorview, notebook_in_nexus);

  // Use the nexus' keymaps as shortcuts!
  // This passes on keydown events from the document to the nexus for handling.
  React.useEffect(() => {
    let fn = (event) => {
      if (event.defaultPrevented) return;
      let should_cancel = runScopeHandlers(nexus_editorview, event, "editor");
      if (should_cancel) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
    };
  }, [nexus_editorview]);

  let child_plugin = React.useMemo(
    () => child_extension(nexus_editorview),
    [nexus_editorview, child_extension]
  );

  /**
   * Keep track of what cells are just created by the users,
   * so we can animate them in 🤩
   */
  let [last_created_cells, set_last_created_cells] = React.useState(
    /** @type {any[]} */ ([])
  );
  useCodemirrorExtension(
    nexus_editorview,
    React.useMemo(
      () =>
        EditorView.updateListener.of((update) => {
          let created_cells = update.transactions.flatMap((transaction) =>
            transaction.effects
              .filter((x) => x.is(AddCellEffect))
              .map((x) => x.value.cell.id)
          );
          if (created_cells.length !== 0) {
            set_last_created_cells(created_cells);
          }
        }),
      [set_last_created_cells]
    )
  );

  let code_and_cell_map = React.useMemo(() => {
    let code = "";
    let cursor = 0;
    /** @type {{ [cell_id: string]: { start: number, end: number } }} */
    let cell_map = {};

    let type_references = `
/// <reference lib="es5" />
/// <reference lib="es2015" />
/// <reference lib="es2015.collection" />
/// <reference lib="es2015.core" />
/// <reference types="node" />
`;
    code += type_references;
    cursor += type_references.length;

    for (let cell_id of notebook.cell_order) {
      let cell = notebook.cells[cell_id];
      // Using unsaved code because I want typescript to be very optimistic
      let code_to_add = cell.unsaved_code;
      cell_map[cell_id] = {
        start: cursor,
        end: cursor + code_to_add.length,
      };
      code += code_to_add + "\n";
      cursor += code_to_add.length + 1;
    }
    // console.log(`code:`, code);
    return { code, cell_map };
  }, [notebook.cell_order, notebook.cells]);

  // useWorker
  /** @type {import("react").MutableRefObject<Worker>} */
  let worker_ref = React.useRef(/** @type {any} */ (null));

  React.useEffect(() => {
    worker_ref.current = create_worker();
    return () => {
      worker_ref.current.terminate();
    };
  }, [create_worker]);

  let do_linting = React.useRef(
    debounce(async () => {
      let x = await post_message(worker_ref.current, {
        type: "request-linting",
        data: undefined,
      });
      console.log(`x:`, x);
    }, 1000)
  ).current;
  React.useEffect(() => {
    console.log("!!!");
    do_linting();
  }, [code_and_cell_map]);

  React.useEffect(() => {
    console.log("Posting file");
    post_message(worker_ref.current, {
      type: "update-notebook-file",
      data: {
        code: code_and_cell_map.code,
      },
    }).then((x) => {
      console.log(`UPDATED:`, x);
    });
  }, [code_and_cell_map]);

  useCodemirrorExtension(nexus_editorview, CellEditorSelection);
  useCodemirrorExtension(
    nexus_editorview,
    CodeAndCellMapFacet.of(code_and_cell_map)
  );

  let request_info_at_position = React.useRef(
    debounce((current_position_maybe) => {
      console.log("Hiii");
      post_message(worker_ref.current, {
        type: "request-info-at-position",
        data: {
          position: current_position_maybe,
        },
      }).then((x) => {
        console.log(`INFO AT POISITION:`, x);
      });
    }, 1000)
  ).current;

  useCodemirrorExtension(
    nexus_editorview,
    React.useMemo(
      () =>
        EditorView.updateListener.of((update) => {
          let code_and_cell_map = update.state.facet(CodeAndCellMapFacet);
          let cell_selection = update.state.field(CellEditorSelection);
          if (
            update.startState.field(CellEditorSelection) !== cell_selection &&
            cell_selection != null
          ) {
            let { cell_id, selection } = cell_selection;
            let cell_position = code_and_cell_map.cell_map[cell_id];
            let current_position_maybe =
              cell_position.start + selection.main.to;
            request_info_at_position(current_position_maybe);
          }
        }),
      []
    )
  );

  useCodemirrorExtension(
    nexus_editorview,
    React.useMemo(() => {
      return keymap.of([
        {
          key: "Ctrl-Space",
          run: ({ state, dispatch }) => {
            let code_and_cell_map = state.facet(CodeAndCellMapFacet);
            let cell_selection = state.field(CellEditorSelection);
            if (cell_selection != null) {
              let { cell_id, selection } = cell_selection;
              let cell_position = code_and_cell_map.cell_map[cell_id];
              let current_position_maybe =
                cell_position.start + selection.main.to;

              post_message(worker_ref.current, {
                type: "request-completions",
                data: {
                  position: current_position_maybe,
                },
              }).then((x) => {
                console.log(`x:`, x);
              });
            }
            return true;
          },
        },
      ]);
    }, [])
  );

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
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={
                        snapshot.isDragging && !snapshot.dropAnimation
                          ? "dragging"
                          : ""
                      }
                    >
                      <ContextMenuWrapper
                        options={[
                          {
                            title: (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <IonIcon icon={planetOutline} />
                                <div style={{ minWidth: 8 }} />
                                Delete
                                <div style={{ flex: 1 }} />
                                <div
                                  style={{ opacity: 0.5, fontSize: "0.8em" }}
                                >
                                  ⌘K
                                </div>
                              </div>
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
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <IonIcon icon={eyeOutline} />
                                <div style={{ minWidth: 8 }} />
                                Fold
                              </div>
                            ),
                            onClick: () => {
                              mutate(cell, (cell) => {
                                cell.folded = !cell.folded;
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
                            mutate(cell, (cell) => {
                              cell.folded = !cell.folded;
                            });
                          }}
                          className="drag-handle"
                        />
                      </ContextMenuWrapper>
                      <Cell
                        cell={cell}
                        cylinder={engine.cylinders[cell.id]}
                        notebook={notebook}
                        maestro_plugin={child_plugin}
                        is_selected={selected_cells.includes(cell.id)}
                        did_just_get_created={last_created_cells.includes(
                          cell.id
                        )}
                      />
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
                <AddButton
                  onClick={() => {
                    let id = uuidv4();
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
              </div>
            </React.Fragment>
          ))}
      </DragAndDropList>
      <SelectionArea
        cell_order={notebook.cell_order}
        on_selection={(selected_cells) => {
          set_selected_cells(selected_cells);
        }}
      />
    </React.Fragment>
  );
};

/**
 * Tiny extension that will put the editor in focus whenever any transaction comes with `scrollIntoView` effect.
 * For example, history uses this. Normally, this doesn't focus the editor, because it is assumed the editor is already in focus.
 * Well guess what, on notebooks it ain't!
 */
let focus_on_scrollIntoView = EditorView.updateListener.of((update) => {
  if (update.transactions.some((tx) => tx.scrollIntoView)) {
    update.view.focus();
  }
});

/**
 * @param {{
 *  cell: import("./App").Cell,
 *  cylinder: import("./App").CylinderShadow,
 *  notebook: import("./App").Notebook,
 *  maestro_plugin: any,
 *  is_selected: boolean,
 *  did_just_get_created: boolean,
 * }} props
 */
export let Cell = ({
  cell,
  cylinder = engine_cell_from_notebook_cell(cell),
  notebook,
  maestro_plugin,
  is_selected,
  did_just_get_created,
}) => {
  let editor_state = useEditorView({
    code: cell.unsaved_code,
  });
  // prettier-ignore
  let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));

  let result_deserialized = React.useMemo(() => {
    if (
      cylinder?.result?.type === "return" ||
      cylinder?.result?.type === "throw"
    ) {
      return {
        type: cylinder.result.type,
        name: cylinder.result.name,
        value: deserialize(0, cylinder.result.value),
      };
    } else {
      return cylinder?.result ?? { type: "pending" };
    }
  }, [cylinder?.result]);

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  let cell_wrapper_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (did_just_get_created) {
      editorview_ref.current.focus();
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
    <CellStyle
      ref={cell_wrapper_ref}
      data-cell-id={cell.id}
      className={compact([
        cylinder.running && "running",
        (cylinder.last_run ?? -Infinity) < (cell.last_run ?? -Infinity) &&
          "pending",
        cylinder.result?.type === "throw" && "error",
        cylinder.result?.type === "return" && "success",
        cell.unsaved_code !== cell.code && "modified",
        is_selected && "selected",
      ]).join(" ")}
    >
      <InspectorContainer>
        <InspectorInnerContainer>
          {result_deserialized.name && (
            <span>
              <span style={{ color: "#afb7d3", fontWeight: "700" }}>
                {result_deserialized.name}
              </span>
              <span>{" = "}</span>
            </span>
          )}
          <Inspector value={result_deserialized} />
        </InspectorInnerContainer>
      </InspectorContainer>

      <EditorStyled
        style={{
          height: cell.folded ? 0 : undefined,
          marginTop: cell.folded ? 0 : undefined,
        }}
      >
        <CodeMirror editor_state={editor_state} ref={editorview_ref}>
          <Extension extension={basic_javascript_setup} />

          <Extension
            extension={EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                mutate(cell, (cell) => {
                  cell.unsaved_code = update.state.doc.toString();
                });
              }
            })}
            deps={[mutator(cell)]}
          />

          {/* <Extension extension={codemirror_interactive} /> */}
          {/* <Extension extension={debug_syntax_plugin} /> */}
          {/* <Extension extension={inline_notebooks_extension} /> */}
          <Extension extension={CellIdFacet.of(cell.id)} />
          <Extension extension={maestro_plugin} />

          <Extension extension={blur_when_other_cell_focus} />
          <Extension extension={focus_on_scrollIntoView} />
          <Extension
            extension={nexus_extension(shared_history())}
            deps={[history]}
          />
          <Extension extension={nexus_extension()} deps={[historyKeymap]} />

          <Extension extension={cell_movement_extension} />
          <Extension extension={awesome_line_wrapping} />
          <Extension extension={cell_keymap} />
        </CodeMirror>
      </EditorStyled>
    </CellStyle>
  );
};

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
  *:hover + div > &,
  div:hover > &,
  div:has(+ *:hover) > & {
    opacity: 1;
  }

  & .show-me-later {
    display: none;
    font-size: 0.8rem;
  }
  &:hover .show-me-later {
    display: inline;
  }
`;
