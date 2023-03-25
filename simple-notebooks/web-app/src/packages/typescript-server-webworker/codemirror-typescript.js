/**
 * AAAAAaaaaaaa
 * Worked in React, time to make it a codemirror extension
 */

import { create_worker, post_message } from "./typescript-server-webworker";

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
          let current_position_maybe = cell_position.start + selection.main.to;
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
