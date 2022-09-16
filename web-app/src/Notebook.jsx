import React from "react";
import { CellEditor } from "./Cell";
import { mutate } from "use-immer-store";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import { Compartment, EditorState, Prec, StateEffect } from "@codemirror/state";
import { EditorView, keymap, runScopeHandlers } from "@codemirror/view";
import { Inspector } from "./Inspector";
import { compact, intersection, without } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { indentUnit } from "@codemirror/language";
import {
  CellIdFacet,
  CellIdOrder,
  child_extension,
  codemirror_nexus,
  NexusFacet,
  nexus_extension,
  ToCellEffect,
} from "./packages/codemirror-nexus/codemirror-nexus";
import {
  cell_movement_extension,
  MoveUpEffect,
} from "./packages/codemirror-nexus/codemirror-cell-movement";
import {
  BlurEffect,
  blur_when_other_cell_focus,
} from "./packages/codemirror-nexus/codemirror-blur-when-other-cell-focus";
import {
  history,
  historyKeymap,
} from "./packages/codemirror-nexus/codemirror-shared-history";
import { SelectionArea } from "./SelectionArea";
import {
  AddCellEffect,
  NotebookFacet,
  notebook_in_nexus,
  RemoveCellEffect,
} from "./notebook-in-nexus";
import { deserialize } from "./deserialize-value-to-show";

let CellStyle = styled.div`
  width: min(700px, 100vw - 200px, 100%);

  background-color: rgba(0, 0, 0, 0.4);

  font-family: Menlo, "Roboto Mono", "Lucida Sans Typewriter", "Source Code Pro",
    monospace;

  &.modified {
    background-color: #744e0021;
  }

  position: relative;
  &::before {
    content: "";
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

  /*
  &.selected {
    outline: #20a5ba 1px solid;
  }
  */

  &.selected::after {
    content: "";
    position: absolute;
    inset: -8px;
    background-color: #20a5ba24;
    pointer-events: none;
  }
`;

let engine_cell_from_notebook_cell = (cell) => {
  return {
    last_run: -Infinity,
    result: null,
    running: false,
  };
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

let CellListStyle = styled.div`
  width: min(700px, 100vw - 200px, 100%);
`;

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

  useCodemirrorExtension(
    nexus_editorview,
    React.useMemo(() => {
      return keymap.of([
        {
          key: "Mod-s",
          run: ({ state, dispatch }) => {
            console.log("SAVE");
            let notebook = state.facet(NotebookFacet);
            mutate(notebook.cells, (cells) => {
              let now = Date.now(); // Just in case immer takes a lot of time
              for (let cell of Object.values(cells)) {
                if (cell.code !== cell.unsaved_code) {
                  cell.code = cell.unsaved_code;
                  cell.last_run = now;
                }
              }
            });
            return true;
          },
        },
      ]);
    }, [])
  );

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

  return (
    <React.Fragment>
      <CellListStyle>
        {notebook.cell_order
          .map((cell_id) => notebook.cells[cell_id])
          .map((cell) => (
            <React.Fragment key={cell.id}>
              <Cell
                cell={cell}
                cylinder={engine.cylinders[cell.id]}
                notebook={notebook}
                maestro_plugin={child_plugin}
                is_selected={selected_cells.includes(cell.id)}
              />
              <div
                style={{
                  height: "1rem",
                  position: "relative",
                }}
                data-can-start-cell-selection
              >
                <AddButton
                  onClick={() => {
                    let id = uuidv4();
                    let my_index = notebook.cell_order.indexOf(cell.id);

                    nexus_editorview.dispatch({
                      effects: AddCellEffect.of({
                        index: my_index + 1,
                        cell: {
                          id: id,
                          code: "",
                          unsaved_code: "",
                          last_run: -Infinity,
                        },
                      }),
                    });
                  }}
                >
                  + <span className="show-me-later">add cell</span>
                </AddButton>
              </div>
            </React.Fragment>
          ))}
      </CellListStyle>
      <SelectionArea
        cell_order={notebook.cell_order}
        on_selection={(selected_cells) => {
          set_selected_cells(selected_cells);
        }}
      />
    </React.Fragment>
  );
};

let InspectorContainer = styled.div`
  font-size: 16px;

  padding-left: calc(16px + 4px);
  padding-right: 16px;
  overflow-y: auto;
  white-space: pre;

  &,
  & * {
    font-style: italic;
  }
`;

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
 * }} props
 */
export let Cell = ({
  cell,
  cylinder = engine_cell_from_notebook_cell(cell),
  notebook,
  maestro_plugin,
  is_selected,
}) => {
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

  return (
    <CellStyle
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
      {(result_deserialized.type === "return" ||
        result_deserialized.type === "throw") && (
        <div style={{ minHeight: 16 }} />
      )}
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

      <CellEditor
        value={cell.unsaved_code}
        input_variables={[]}
        onChange={(value) => {
          mutate(cell, (cell) => {
            cell.unsaved_code = value;
          });
        }}
      >
        {/* <Extension extension={debug_syntax_plugin} /> */}
        {/* <Extension extension={inline_notebooks_extension} /> */}
        <Extension extension={CellIdFacet.of(cell.id)} />
        <Extension extension={maestro_plugin} />

        <Extension extension={blur_when_other_cell_focus} />
        <Extension extension={focus_on_scrollIntoView} />
        <Extension extension={nexus_extension(history())} deps={[history]} />
        <Extension
          extension={nexus_extension(keymap.of(historyKeymap))}
          deps={[historyKeymap]}
        />

        <Extension extension={cell_movement_extension} />
        <Extension extension={awesome_line_wrapping} />
        <Extension extension={EditorState.tabSize.of(4)} deps={[]} />
        <Extension extension={indentUnit.of("\t")} deps={[]} />
        <Extension
          extension={Prec.high(
            keymap.of([
              {
                key: "Shift-Enter",
                run: (view) => {
                  mutate(cell, (cell) => {
                    cell.code = cell.unsaved_code;
                    cell.is_waiting = true;
                    cell.last_run = Date.now();
                  });
                  return true;
                },
              },
              {
                key: "Backspace",
                run: (view) => {
                  let nexus = view.state.facet(NexusFacet);
                  if (view.state.doc.length === 0) {
                    // Focus on previous cell
                    view.dispatch({
                      effects: [MoveUpEffect.of({ start: "end" })],
                    });
                    // Remove cell
                    nexus.dispatch({
                      effects: [RemoveCellEffect.of({ cell_id: cell.id })],
                    });
                    return true;
                  } else {
                    return false;
                  }
                },
              },
            ])
          )}
        />
      </CellEditor>
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
  ${CellStyle}:hover + div > &,
  div:hover > &,
  div:has(+ ${CellStyle}:hover) & {
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
