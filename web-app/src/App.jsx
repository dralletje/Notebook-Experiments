import React from "react";
import "./App.css";
import { produce } from "immer";
import { mutate, useMutateable } from "use-immer-store";

import { io, Socket } from "socket.io-client";
import { CellList } from "./Notebook";
import styled from "styled-components";
import { deserialize } from "./deserialize-value-to-show";

import dot from "@observablehq/graphviz";

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
 * @property {string} id
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

let AppStyle = styled.div`
  padding-top: 100px;
  min-height: 100vh;
  padding-bottom: 100px;
  margin-right: 20px;
`;

let MyButton = styled.button`
  font-size: 0.6rem;
  hyphens: auto;
  text-align: center;
  border: none;

  display: flex;
  flex-direction: column;
  align-items: center;

  &.active {
    background-color: #e6e6e6;
    color: black;
  }
`;

let DependenciesTab = () => {
  return (
    <div style={{ padding: 16 }}>
      <h1>Dependencies</h1>
    </div>
  );
};

let GraphTab = ({ dag }) => {
  let ref = React.useRef();
  React.useEffect(() => {
    console.log(`engine:`, dag);
    let element = dot`
      digraph {
        ${Object.values(dag)
          .flatMap((from) => from.out.map((to) => `"${from.id}" -> "${to.id}"`))
          .join("\n")}
      }
    `;
    console.log(`element:`, element);
    // Remove children
    while (ref.current.firstChild) {
      ref.current.removeChild(ref.current.firstChild);
    }
    ref.current.appendChild(element);
  }, [dag]);
  return (
    <div style={{ padding: 16 }}>
      <h1>Graph</h1>
      <div ref={ref}></div>
    </div>
  );
};

let ShellTab = () => {
  return (
    <div style={{ padding: 16 }}>
      <h1>Shell</h1>
    </div>
  );
};

let try_json = (str) => {
  try {
    return JSON.parse(str);
  } catch (error) {
    return null;
  }
};

function App() {
  let [_notebook, _set_notebook] = React.useState(
    try_json(localStorage.getItem("_notebook")) ??
      /** @type {Notebook} */ ({
        id: "1",
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
            code: "let xs = [1,2,3,4]",
            unsaved_code: "let xs = [1,2,3,4]",
            last_run: Date.now(),
          },
        },
      })
  );

  let update_state = React.useCallback(
    (update_fn) => {
      _set_notebook((old_notebook) => {
        // let [new_notebook, patches, reverse_patches] = produceWithPatches(
        //   old_notebook,
        //   update_fn
        // );
        let new_notebook = produce(old_notebook, update_fn);
        localStorage.setItem("_notebook", JSON.stringify(new_notebook));
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

  let [open_tab, set_open_tab] = React.useState(
    /** @type {null | "graph" | "dependencies" | "shell"} */
    (null)
  );

  // @ts-ignore
  let dag = React.useMemo(
    // @ts-ignore
    () => (engine.dag == null ? null : deserialize(0, engine.dag)),
    // @ts-ignore
    [engine.dag]
  );

  return (
    <div style={{ display: "flex" }}>
      <AppStyle style={{ flex: 1 }} data-can-start-cell-selection>
        <CellList notebook={notebook} engine={engine} />
      </AppStyle>
      {open_tab != null && (
        <div
          style={{
            width: 400,
            backgroundColor: "rgba(255,255,255,.05)",
            height: "100vh",
            position: "sticky",
            top: 0,
          }}
        >
          {open_tab === "graph" && <GraphTab dag={dag} />}
          {open_tab === "dependencies" && <DependenciesTab />}
          {open_tab === "shell" && <ShellTab />}
        </div>
      )}
      <div
        style={{
          width: 50,
          backgroundColor: "rgba(0,0,0,.4)",
          height: "100vh",
          position: "sticky",
          top: 0,

          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "stretch",
          paddingTop: 32,
          paddingBottom: 32,
        }}
      >
        <MyButton
          className={open_tab === "graph" ? "active" : ""}
          onClick={() => {
            set_open_tab((x) => (x === "graph" ? null : "graph"));
          }}
        >
          graph
        </MyButton>
        <MyButton
          className={open_tab === "dependencies" ? "active" : ""}
          onClick={() => {
            set_open_tab((x) => (x === "dependencies" ? null : "dependencies"));
          }}
        >
          dependencies
        </MyButton>
        <MyButton
          className={open_tab === "shell" ? "active" : ""}
          onClick={() => {
            set_open_tab((x) => (x === "shell" ? null : "shell"));
          }}
        >
          shell
        </MyButton>
      </div>
    </div>
  );
}

export default App;
