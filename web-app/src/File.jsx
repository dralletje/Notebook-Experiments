import React from "react";

import { io, Socket } from "socket.io-client";
import { CellList, LastCreatedCells } from "./Notebook";
import styled from "styled-components";
import { deserialize } from "./deserialize-value-to-show";

import dot from "@observablehq/graphviz";
import { IonIcon } from "@ionic/react";
import {
  gitNetworkOutline,
  iceCreamOutline,
  pizzaOutline,
  terminalOutline,
} from "ionicons/icons";
import { EditorState, Facet, StateField } from "@codemirror/state";
import {
  CellEditorStatesField,
  CellIdFacet,
  CellMetaField,
  CellTypeFacet,
  editor_state_for_cell,
  nested_cell_states_basics,
  updateListener,
  useNotebookview,
  useNotebookviewWithExtensions,
} from "./NotebookEditor";
import { useRealMemo } from "use-real-memo";
import {
  SelectCellsEffect,
  SelectedCellsField,
  selected_cells_keymap,
} from "./cell-selection";
import { keymap, runScopeHandlers } from "@codemirror/view";
import {
  shared_history,
  historyKeymap,
} from "./packages/codemirror-nexus/codemirror-shared-history";
import { isEqual, mapValues, sortBy } from "lodash";
import {
  CellIdOrder,
  cell_movement_extension_default,
} from "./packages/codemirror-nexus/codemirror-cell-movement";
import { notebook_keymap } from "./packages/codemirror-nexus/add-move-and-run-cells";
import { ShowKeysPressed } from "./ShowKeys";
import { MetaNotebook } from "./MetaNotebook";
import { SelectionArea } from "./selection-area/SelectionArea";
import { blur_stuff } from "./blur-stuff";
import {
  create_worker,
  post_message,
} from "./packages/babel-worker/babel-worker";

// let worker = create_worker();
// console.log(`worker:`, worker);

// post_message(worker, {
//   type: "transform-code",
//   data: {
//     code: `let x = 1;`,
//   },
// }).then((x) => {
//   console.log(`x:`, x);
// });

let AppStyle = styled.div`
  padding-top: 100px;
  min-height: 100vh;
  padding-bottom: 100px;
  margin-right: 20px;

  flex: 1;
  flex-basis: min(700px, 100vw - 200px, 100%);
  min-width: 0;
`;

let MyButton = styled.button`
  font-size: 0.6rem;
  hyphens: auto;
  text-align: center;
  border: none;

  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;

  &.active {
    background-color: rgb(45 21 29);
    color: white;
  }

  ion-icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }
`;

let DependenciesTab = () => {
  return (
    <div style={{ padding: 16 }}>
      <h1>Dependencies</h1>
      <p>
        Automatically manage dependencies, but actually nice this time. Possibly
        having the actual `import X from "..."` cells living here.
      </p>
    </div>
  );
};

// let LOCALSTORAGE_KEY = "ASDASDASD";
let LOCALSTORAGE_KEY = "notebook";

let GraphTab = ({ dag }) => {
  /** @type {any} */
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
      <p>
        A graph/visualisation of how the cells are connected... haven't figured
        out a nice way yet, so here is a ugly graph.
      </p>
      <div ref={ref}></div>
    </div>
  );
};

let ShellTab = () => {
  return (
    <div style={{ padding: 16 }}>
      <h1>Shell</h1>
      <p>
        Very ambitious: I want this to be a linear notebook that works kind of
        like a REPL, having access to the variables created in the main
        notebook, but not the other way around. And then, ideally, being able to
        drag cells from here to the main notebook.
      </p>
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

let cell_id_order_from_notebook_facet = CellIdOrder.compute(
  [CellEditorStatesField],
  (state) => state.field(CellEditorStatesField).cell_order
);

let JustForKicksFacet = Facet.define({});

let UpdateLocalStorage = updateListener.of((viewupdate) => {
  let cell_state = viewupdate.state.field(CellEditorStatesField);
  localStorage.setItem(
    LOCALSTORAGE_KEY,
    JSON.stringify(
      /** @type {import("./notebook-types").Notebook} */ ({
        id: "hi",
        cell_order: cell_state.cell_order,
        cells: mapValues(cell_state.cells, (cell_state) => {
          let meta = cell_state.field(CellMetaField);
          return /** @type {import("./notebook-types").Cell} */ ({
            id: cell_state.facet(CellIdFacet),
            code: meta.code,
            unsaved_code: cell_state.doc.toString(),
            last_run: meta.last_run,
            folded: meta.folded,
            type: cell_state.facet(CellTypeFacet),
          });
        }),
      })
    )
  );
});

export function File({ state }) {
  let { viewupdate } = useNotebookview(state);

  let cell_editor_states = state.field(CellEditorStatesField);

  let notebook = React.useMemo(() => {
    return /** @type {import("./notebook-types").Notebook} */ ({
      cell_order: cell_editor_states.cell_order,
      cells: mapValues(cell_editor_states.cells, (cell_state) => {
        return {
          id: cell_state.facet(CellIdFacet),
          unsaved_code: cell_state.doc.toString(),
          ...cell_state.field(CellMetaField),
          type: cell_state.facet(CellTypeFacet),
        };
      }),
    });
  }, [cell_editor_states]);

  // Use the nexus' keymaps as shortcuts!
  // This passes on keydown events from the document to the nexus for handling.
  React.useEffect(() => {
    let fn = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      let should_cancel = runScopeHandlers(
        // @ts-ignore
        viewupdate.view,
        event,
        "editor"
      );
      if (should_cancel) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
    };
  }, [viewupdate.view]);

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
    /** @type {null | "graph" | "dependencies" | "shell" | "meta"} */
    (null)
  );

  // @ts-ignore
  let dag = React.useMemo(
    // @ts-ignore
    () => (engine.dag == null ? null : deserialize(0, engine.dag)),
    // @ts-ignore
    [engine.dag]
  );

  let selected_cells = viewupdate.state.field(SelectedCellsField);

  return (
    <div style={{ display: "flex", flex: 1 }}>
      <SelectionArea
        on_selection={(new_selected_cells) => {
          if (!isEqual(new_selected_cells, selected_cells)) {
            viewupdate.view.dispatch({
              effects: SelectCellsEffect.of(new_selected_cells),
            });
          }
        }}
      >
        <AppStyle>
          <CellList
            viewupdate={viewupdate}
            notebook_view={viewupdate.view}
            notebook={notebook}
            engine={engine}
          />
        </AppStyle>
        <div style={{ flex: 1 }} />
      </SelectionArea>

      {open_tab != null && (
        <div
          style={{
            width: 400,
            backgroundColor: "rgb(45 21 29)",
            height: "100vh",
            position: "sticky",
            top: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {open_tab === "graph" && <GraphTab dag={dag} />}
          {open_tab === "dependencies" && <DependenciesTab />}
          {open_tab === "shell" && <ShellTab />}
          {open_tab === "meta" && <MetaNotebook />}
        </div>
      )}
      <div
        style={{
          flex: "0 0 50px",
          backgroundColor: "rgba(0,0,0,.4)",
          height: "100vh",
          position: "sticky",
          top: 0,

          display: "flex",
          flexDirection: "column",
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
          <IonIcon icon={gitNetworkOutline} />
          graph
        </MyButton>
        <MyButton
          className={open_tab === "dependencies" ? "active" : ""}
          onClick={() => {
            set_open_tab((x) => (x === "dependencies" ? null : "dependencies"));
          }}
        >
          <IonIcon icon={pizzaOutline} />
          dependencies
        </MyButton>
        <MyButton
          className={open_tab === "shell" ? "active" : ""}
          onClick={() => {
            set_open_tab((x) => (x === "shell" ? null : "shell"));
          }}
        >
          <IonIcon icon={terminalOutline} />
          shell
        </MyButton>
        <MyButton
          className={open_tab === "meta" ? "active" : ""}
          onClick={() => {
            set_open_tab((x) => (x === "meta" ? null : "meta"));
          }}
        >
          <IonIcon icon={iceCreamOutline} />
          meta
        </MyButton>

        {/* <ShowKeysPressed /> */}
      </div>
    </div>
  );
}
