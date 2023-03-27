/**
 * AAAAAaaaaaaa
 * Worked in React, time to make it a codemirror extension
 */

import { EditorState } from "@codemirror/state";
import { create_worker, post_message } from "./typescript-server-webworker";
import { EditorView, keymap } from "@codemirror/view";
import { CellEditorsField, updateListener } from "../codemirror-notebook/cell";
import {
  EditorInChief,
  EditorInChiefKeymap,
} from "../codemirror-editor-in-chief/editor-in-chief.js";

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

// /** @type {Facet<CellAndCodeMap, CellAndCodeMap>} */
// let CodeAndCellMapFacet = Facet.define({
//   combine: (values) => values[0],
// });

/**
 * @param {(state: EditorInChief) => CellAndCodeMap} get_cells
 */
export let typescript_extension = (get_cells) => {
  console.log("Yes");

  let worker = create_worker();
  let last_code = "";

  return [
    updateListener.of((update) => {
      let code_and_cell_map = get_cells(update.state);
      console.log(`code:`, code_and_cell_map);

      let notebook = update.state.field(CellEditorsField);
      console.log(
        `notebook.cell_with_current_selection:`,
        notebook.cell_with_current_selection
      );

      if (
        notebook.cell_with_current_selection &&
        notebook.cells[notebook.cell_with_current_selection]
      ) {
        let start =
          code_and_cell_map.cell_map[notebook.cell_with_current_selection]
            .start;
        let length =
          notebook.cells[notebook.cell_with_current_selection].selection.main
            .anchor;
        let current_position_maybe = start + length;

        // @ts-ignore
        post_message(worker, {
          type: "request-info-at-position",
          data: {
            position: current_position_maybe,
          },
        }).then((x) => {
          console.log(`INFO AT POISITION:`, x);
        });
      }

      if (code_and_cell_map.code !== last_code) {
        last_code = code_and_cell_map.code;
        post_message(worker, {
          type: "update-notebook-file",
          data: {
            code: code_and_cell_map.code,
          },
        }).then((x) => {});
      }

      // post_message(worker, {
      //   type: "update-notebook-file",
      //   data: {
      //     code: code_and_cell_map.code,
      //   },
      // }).then((x) => {
      //   let notebook = update.state.field(CellEditorsField);
      //   console.log(
      //     `notebook.cell_with_current_selection:`,
      //     notebook.cell_with_current_selection
      //   );
      // });
    }),
    EditorInChiefKeymap.of([
      {
        key: "Ctrl-Space",
        run: ({ state, dispatch }) => {
          let code_and_cell_map = get_cells(state);
          let notebook = state.field(CellEditorsField);

          if (
            notebook.cell_with_current_selection &&
            notebook.cells[notebook.cell_with_current_selection]
          ) {
            let start =
              code_and_cell_map.cell_map[notebook.cell_with_current_selection]
                .start;
            let length =
              notebook.cells[notebook.cell_with_current_selection].selection
                .main.anchor;
            let current_position_maybe = start + length;

            // @ts-ignore
            post_message(worker, {
              type: "request-completions",
              data: {
                position: current_position_maybe,
              },
            }).then((x) => {
              console.log(`REQUEST COMPLETIONS:`, x);
            });
          }
          return true;
        },
      },
    ]),
  ];
};

// // useWorker
// /** @type {import("react").MutableRefObject<Worker>} */
// let worker_ref = React.useRef(/** @type {any} */ (null));

// React.useEffect(() => {
//   worker_ref.current = create_worker();
//   return () => {
//     worker_ref.current.terminate();
//   };
// }, [create_worker]);

// let do_linting = React.useRef(
//   debounce(async () => {
//     let x = await post_message(worker_ref.current, {
//       type: "request-linting",
//       data: undefined,
//     });
//     console.log(`x:`, x);
//   }, 1000)
// ).current;

// React.useEffect(() => {
//   console.log("!!!");
//   do_linting();
// }, [code_and_cell_map]);

// React.useEffect(() => {
//   console.log("Posting file");
//   post_message(worker_ref.current, {
//     type: "update-notebook-file",
//     data: {
//       code: code_and_cell_map.code,
//     },
//   }).then((x) => {
//     console.log(`UPDATED:`, x);
//   });
// }, [code_and_cell_map]);

// useCodemirrorExtension(nexus_editorview, CellEditorSelection);
// useCodemirrorExtension(
//   nexus_editorview,
//   CodeAndCellMapFacet.of(code_and_cell_map)
// );

// let request_info_at_position = React.useRef(
//   debounce((current_position_maybe) => {
//     console.log("Hiii");
//     post_message(worker_ref.current, {
//       type: "request-info-at-position",
//       data: {
//         position: current_position_maybe,
//       },
//     }).then((x) => {
//       console.log(`INFO AT POISITION:`, x);
//     });
//   }, 1000)
// ).current;

// useCodemirrorExtension(
//   nexus_editorview,
//   React.useMemo(
//     () =>
//       EditorView.updateListener.of((update) => {
//         let code_and_cell_map = update.state.facet(CodeAndCellMapFacet);
//         let cell_selection = update.state.field(CellEditorSelection);
//         if (
//           update.startState.field(CellEditorSelection) !== cell_selection &&
//           cell_selection != null
//         ) {
//           let { cell_id, selection } = cell_selection;
//           let cell_position = code_and_cell_map.cell_map[cell_id];
//           let current_position_maybe = cell_position.start + selection.main.to;
//           request_info_at_position(current_position_maybe);
//         }
//       }),
//     []
//   )
// );

// useCodemirrorExtension(
//   nexus_editorview,
//   React.useMemo(() => {
//     return keymap.of([
//       {
//         key: "Ctrl-Space",
//         run: ({ state, dispatch }) => {
//           let code_and_cell_map = state.facet(CodeAndCellMapFacet);
//           let cell_selection = state.field(CellEditorSelection);
//           if (cell_selection != null) {
//             let { cell_id, selection } = cell_selection;
//             let cell_position = code_and_cell_map.cell_map[cell_id];
//             let current_position_maybe =
//               cell_position.start + selection.main.to;

//             post_message(worker_ref.current, {
//               type: "request-completions",
//               data: {
//                 position: current_position_maybe,
//               },
//             }).then((x) => {
//               console.log(`x:`, x);
//             });
//           }
//           return true;
//         },
//       },
//     ]);
//   }, [])
// );
