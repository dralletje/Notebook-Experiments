import React from "react";
import "./App.css";
import { produce } from "immer";
import { mutate, useMutateable } from "use-immer-store";

import { io, Socket } from "socket.io-client";
import { CellList } from "./Notebook";

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

function App() {
  let [_notebook, _set_notebook] = React.useState(
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
        // let [new_notebook, patches, reverse_patches] = produceWithPatches(
        //   old_notebook,
        //   update_fn
        // );
        let new_notebook = produce(old_notebook, update_fn);

        // console.log(`patches:`, patches);
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

  return (
    <div className="App" data-can-start-cell-selection>
      <CellList notebook={notebook} engine={engine} />
    </div>
  );
}

export default App;
