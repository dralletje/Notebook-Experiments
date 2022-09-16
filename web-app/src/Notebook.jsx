import React from "react";
import { CellEditor } from "./Cell";
import { mutate } from "use-immer-store";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import { Compartment, EditorState, Prec, StateEffect } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { Inspector } from "./Inspector";
import { compact, without } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { indentUnit } from "@codemirror/language";
import {
  CellIdFacet,
  CellIdOrder,
  child_extension,
  codemirror_nexus,
  nexus_extension,
} from "./packages/codemirror-nexus/codemirror-nexus";
import {
  cell_movement_extension,
  MoveUpEffect,
} from "./packages/codemirror-nexus/codemirror-cell-movement";
import { blur_when_other_cell_focus } from "./packages/codemirror-nexus/codemirror-blur-when-other-cell-focus";
import {
  history,
  historyKeymap,
} from "./packages/codemirror-nexus/codemirror-shared-history";

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
    bottom: 1rem;
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

  padding-bottom: 1rem;
  &::after {
    content: "";
    position: absolute;
    inset: 0px;
    top: calc(100% - 1rem);
    background-color: #121212;
  }
`;

let engine_cell_from_notebook_cell = (cell) => {
  return {
    last_run: -Infinity,
    result: null,
    running: false,
  };
};

let error = (message) => {
  throw new Error(message);
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

/**
 * @param {{
 *  notebook: import("./App").Notebook,
 *  engine: import("./App").EngineShadow,
 * }} props
 */
export let CellList = ({ notebook, engine }) => {
  // I'm adding `cell_id_order_compartment` here manually (and at construction time) vs. using `useCodemirrorExtension`
  // because else the compartment will only be added after all the extensions from children are added,
  // and they won't have CellIdOrder yet, making things harder...
  // TODO Maybe I need to add the compartment based on the render? idk, need componentWillMount 🥲
  let cell_id_order_compartment = React.useRef(new Compartment()).current;
  let nexus_editorview = React.useMemo(
    () =>
      codemirror_nexus([
        cell_id_order_compartment.of(CellIdOrder.of(notebook.cell_order)),
      ]),
    [codemirror_nexus, cell_id_order_compartment]
  );
  React.useLayoutEffect(() => {
    nexus_editorview.dispatch?.({
      effects: cell_id_order_compartment.reconfigure(
        CellIdOrder.of(notebook.cell_order)
      ),
    });
  }, [nexus_editorview, notebook.cell_order]);

  useCodemirrorExtension(
    nexus_editorview,
    React.useMemo(() => {
      return keymap.of([
        {
          key: "Mod-s",
          run: () => {
            console.log("SAVE");
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
    }, [notebook])
  );

  let child_plugin = React.useMemo(
    () => child_extension(nexus_editorview),
    [nexus_editorview, child_extension]
  );
  return (
    <div className="App">
      {notebook.cell_order
        .map((cell_id) => notebook.cells[cell_id])
        .map((cell) => (
          <Cell
            key={cell.id}
            cell={cell}
            cylinder={engine.cylinders[cell.id]}
            notebook={notebook}
            maestro_plugin={child_plugin}
          />
        ))}
    </div>
  );
};

let create_function_with_name_and_body = (name, body) => {
  var func = new Function(`return function ${name}(){ ${body} }`)();
  return func;
};

let deserialize = (index, heap, result_heap = {}) => {
  if (result_heap[index] != null) return result_heap[index];

  let result = heap[index];
  if (result.type === "object") {
    let x = {};
    result_heap[index] = x;
    for (let { key, value } of result.value) {
      x[deserialize(key, heap)] = deserialize(value, heap, result_heap);
    }
    return x;
  } else if (result.type === "array") {
    let xs = [];
    result_heap[index] = xs;
    for (let value of result.value) {
      xs.push(deserialize(value, heap, result_heap));
    }
    return xs;
  } else if (result.type === "string") {
    return result.value;
  } else if (result.type === "number") {
    return result.value;
  } else if (result.type === "boolean") {
    return result.value;
  } else if (result.type === "null") {
    return null;
  } else if (result.type === "undefined") {
    return undefined;
  } else if (result.type === "function") {
    return create_function_with_name_and_body(result.name, result.body);
  } else if (result.type === "symbol") {
    return Symbol(result.value);
  } else if (result.type === "date") {
    return new Date(result.value);
  } else if (result.type === "regexp") {
    return new RegExp(result.value.src, result.value.flags);
  } else if (result.type === "error") {
    let error = new Error(result.value.message);
    error.name = result.value.name;
    error.stack = result.value.stack;
    console.log(`error:`, error);
    return error;
  } else if (result.type === "nan") {
    return NaN;
  } else {
    return { $cant_deserialize: result };
  }
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
 * }} props
 */
export let Cell = ({
  cell,
  cylinder = engine_cell_from_notebook_cell(cell),
  notebook,
  maestro_plugin,
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
      className={compact([
        cylinder.running && "running",
        (cylinder.last_run ?? -Infinity) < (cell.last_run ?? -Infinity) &&
          "pending",
        cylinder.result?.type === "throw" && "error",
        cylinder.result?.type === "return" && "success",
        cell.unsaved_code !== cell.code && "modified",
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
                  if (view.state.doc.length === 0) {
                    // Focus on previous cell
                    view.dispatch({
                      effects: [MoveUpEffect.of({ start: "end" })],
                    });
                    // Remove cell
                    mutate(notebook, (notebook) => {
                      notebook.cell_order = without(
                        notebook.cell_order,
                        cell.id
                      );
                      delete notebook.cells[cell.id];
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

      <AddButton
        onClick={() => {
          mutate(notebook, (notebook) => {
            let id = uuidv4();
            notebook.cells[id] = {
              id: id,
              code: "",
              unsaved_code: "",
              last_run: -Infinity,
            };
            let my_index = notebook.cell_order.indexOf(cell.id);
            notebook.cell_order.splice(my_index + 1, 0, id);
          });
        }}
      >
        + <span className="show-me-later">add cell</span>
      </AddButton>
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

  display: none;
  ${CellStyle}:hover & {
    display: block;
  }

  & .show-me-later {
    display: none;
    font-size: 0.8rem;
  }
  &:hover .show-me-later {
    display: inline;
  }
`;
