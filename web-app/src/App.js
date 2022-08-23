import React from "react";
import "./App.css";
import { CellEditor } from "./Cell";
import { mutate, readonly } from "use-immer-store";
import { enablePatches, produceWithPatches } from "immer";
import styled from "styled-components/macro";
import { useMutateable } from "use-immer-store";
import { Extension } from "codemirror-x-react";
import { EditorState, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { Inspector } from "./Inspector.js";
import { compact, without } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { io, Socket } from "socket.io-client";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { indentUnit } from "@codemirror/language";

enablePatches();

let CellStyle = styled.div`
  width: min(700px, 100vw - 200px);

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
    inset: -3px;
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

/**
 * @typedef EngineShadow
 * @property {{ [id: string]: CylinderShadow }} cylinders
 *
 * @typedef CylinderShadow
 * @property {number?} last_run
 * @property {any} result
 * @property {boolean} running
 */

/**
 * @typedef CellId
 * @type {string}
 *
 * @typedef Notebook
 * @property {{ [key: CellId]: Cell }} cells
 * @property {CellId[]} cell_order
 *
 * @typedef Cell
 * @property {CellId} id
 * @property {string} code
 * @property {string} unsaved_code
 * @property {number} last_run
 * @property {boolean} [is_waiting]
 */

let error = (message) => {
  throw new Error(message);
};

function App() {
  let [_notebook, _set_notebook] = React.useState(
    /** @type {Notebook} */ ({
      cell_order: ["1", "2"],
      cells: {
        1: {
          id: "1",
          code: "1 + 1 + xs.length",
          unsaved_code: "1 + 1 + xs.length",
          last_run: Date.now(),
        },
        2: {
          id: "2",
          code: "xs = [1,2,3,4]",
          unsaved_code: "xs = [1,2,3,4]",
          last_run: Date.now(),
        },
      },
    })
  );

  let update_state = React.useCallback(
    (update_fn) => {
      _set_notebook((old_notebook) => {
        let [new_notebook, patches, reverse_patches] = produceWithPatches(
          old_notebook,
          update_fn
        );
        console.log(`patches:`, patches);
        return new_notebook;
      });
    },
    [_set_notebook]
  );

  /** @type {Notebook} */
  let notebook = useMutateable(_notebook, update_state);

  let [engine, set_engine] = React.useState({ cylinders: {} });
  /** @type {React.MutableRefObject<Socket<any, any>>} */
  let socketio_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    let socket = io("http://localhost:3099");

    socket.on("engine", (engine) => {
      console.log(`engine:`, engine);
      set_engine(engine);
    });
    socketio_ref.current = socket;

    return () => {
      socket.close();
    };
  }, []);

  React.useEffect(() => {
    let socket = socketio_ref.current;
    let fn = () => {
      socket.emit("notebook", notebook);
    };
    socket.on("connect", fn);
    return () => {
      socket.off("connect", fn);
    };
  }, [notebook]);

  React.useEffect(() => {
    let socket = socketio_ref.current;
    socket.emit("notebook", notebook);
  }, [notebook]);

  console.log(`notebook:`, readonly(notebook));
  console.log(`engine:`, engine);
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
            onSave={() => {
              mutate(notebook.cells, (cells) => {
                let now = Date.now(); // Just in case immer takes a lot of time
                for (let cell of Object.values(cells)) {
                  if (cell.code !== cell.unsaved_code) {
                    cell.code = cell.unsaved_code;
                    cell.last_run = now;
                  }
                }
              });
            }}
            onRemove={() => {
              mutate(notebook, (notebook) => {
                delete notebook.cells[cell.id];
                notebook.cell_order = without(notebook.cell_order, cell.id);
              });
            }}
          />
        ))}
    </div>
  );
}

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
  } else {
    console.log(`result:`, result);
    return "Wooop";
  }
};

let InspectorContainer = styled.div`
  font-size: 16px;

  padding-left: calc(16px + 4px);
  padding-right: 16px;
  overflow-y: auto;
  white-space: pre;
`;

/**
 * @param {{ cell: Cell, cylinder: CylinderShadow, onSave: () => void, onRemove: () => void, notebook: Notebook }} props
 */
let Cell = ({
  cell,
  cylinder = engine_cell_from_notebook_cell(cell),
  onSave,
  onRemove,
  notebook,
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
      {/* {(result_deserialized.type === "return" ||
        result_deserialized.type === "throw") && (
        <div style={{ minHeight: 8 }} />
      )} */}

      <CellEditor
        value={cell.unsaved_code}
        input_variables={[]}
        onChange={(value) => {
          mutate(cell, (cell) => {
            cell.unsaved_code = value;
          });
        }}
      >
        <Extension extension={awesome_line_wrapping} />
        <Extension extension={EditorState.tabSize.of(4)} />
        <Extension extension={indentUnit.of("\t")} />
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
                    onRemove();
                    return true;
                  } else {
                    return false;
                  }
                },
              },
              {
                key: "Cmd-s",
                run: () => {
                  onSave();
                  return true;
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

export default App;
