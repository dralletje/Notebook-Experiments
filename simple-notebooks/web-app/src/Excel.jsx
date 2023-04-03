import React from "react";
import { produce } from "immer";
import { chunk, isEmpty, mapValues, range, throttle } from "lodash";
import styled from "styled-components";
import {
  CellMetaField,
  CellTypeFacet,
} from "./packages/codemirror-notebook/cell";
import {
  SelectedCellsField,
  selected_cells_keymap,
} from "./packages/codemirror-notebook/cell-selection";
import { EditorView, keymap } from "@codemirror/view";
import {
  shared_history,
  historyKeymap,
} from "./packages/codemirror-editor-in-chief/codemirror-shared-history";
import {
  CellIdOrder,
  cell_movement_extension,
} from "./packages/codemirror-notebook/cell-movement";
import { NotebookView } from "./Notebook";
import {
  NotebookFilename,
  NotebookId,
} from "./packages/codemirror-notebook/cell";
// import { typescript_extension } from "./packages/typescript-server-webworker/codemirror-typescript.js";
import {
  EditorInChief,
  EditorExtension,
  create_nested_editor_state,
  EditorInChiefKeymap,
  EditorIdFacet,
  extract_nested_viewupdate,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";

import { WorkerEnvironment } from "./environment/WorkerEnvironment";
import {
  CodemirrorFromViewUpdate,
  useViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { cell_keymap } from "./packages/codemirror-notebook/add-move-and-run-cells.js";
import { useEngine } from "./environment/use-engine.js";
import { Inspector } from "inspector-x-react";
import { deserialize } from "./yuck/deserialize-value-to-show.js";

/**
 * @typedef Workspace
 * @property {string} id
 * @property {{
 *  [filename: string]: {
 *    filename: string,
 *    state: EditorInChief,
 *  }
 * }} files
 */

/**
 * @typedef Excell
 * @type {{
 *  id: string,
 *  code: string,
 *  unsaved_code: string
 * }}
 */

/**
 * @param {EditorInChief} editorstate
 * @param {Excell} cell
 */
export let create_cell_state = (editorstate, cell) => {
  return create_nested_editor_state({
    parent: editorstate.editorstate,
    editor_id: /** @type {any} */ (cell.id),
    doc: cell.unsaved_code ?? cell.code,
    extensions: [
      // @ts-ignore
      EditorIdFacet.of(cell.id),
      CellMetaField.init(() => ({
        code: cell.code,
        requested_run_time: 0,
        folded: false,
        type: "code",
      })),
    ],
  });
};

// const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET = "ABCDEF";
// @ts-ignore
let EXCEL_CELLS =
  /** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId[]} */ (
    range(1, 5).flatMap((i) => ALPHABET.split("").map((j) => `${j}${i}`))
  );
export let notebook_to_state = () => {
  return EditorInChief.create({
    editors: (editorstate) => {
      return Object.fromEntries(
        EXCEL_CELLS.map((cell_id) => [
          cell_id,
          create_cell_state(editorstate, {
            id: cell_id,
            code: "1",
            unsaved_code: "1",
          }),
        ])
      );
    },
    extensions: [
      SelectedCellsField,
      selected_cells_keymap,

      EditorExtension.of(cell_keymap),
      // notebook_keymap,

      // NotebookId.of(notebook.id),
      // NotebookFilename.of(filename),

      // EditorExtension.of(
      //   EditorView.scrollMargins.of(() => ({ top: 200, bottom: 100 }))
      // ),

      // This works so smooth omg
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],

      // typescript_extension((state) => {
      //   let notebook = state.field(CellEditorsField);

      //   let code = "";
      //   let cursor = 0;
      //   /** @type {{ [cell_id: string]: { start: number, end: number } }} */
      //   let cell_map = {};

      //   let type_references = `
      //   /// <reference lib="es5" />
      //   /// <reference lib="es2015" />
      //   /// <reference lib="es2015.collection" />
      //   /// <reference lib="es2015.core" />
      //   /// <reference types="node" />
      //   `;
      //   code += type_references;
      //   cursor += type_references.length;

      //   for (let cell_id of notebook.cell_order) {
      //     let cell_state = notebook.cells[cell_id];
      //     let cell = cell_state.field(CellMetaField);
      //     let unsaved_code = cell_state.doc.toString();

      //     // Using unsaved code because I want typescript to be very optimistic
      //     let code_to_add = unsaved_code;
      //     cell_map[cell_id] = {
      //       start: cursor,
      //       end: cursor + code_to_add.length,
      //     };
      //     code += code_to_add + "\n";
      //     cursor += code_to_add.length + 1;
      //   }

      //   return { code, cell_map };
      // }),
    ],
  });
};

export function Excell() {
  let [state, set_state] = React.useState(() => notebook_to_state());
  let environment = React.useRef(WorkerEnvironment).current;

  let viewupdate = useViewUpdate(state, set_state);
  // useCodemirrorKeyhandler(viewupdate);

  let cell_editor_states = state.editors;
  let selected_cells = viewupdate.state.field(SelectedCellsField);
  let editor_in_chief = viewupdate.view;

  /**
   * Keep track of what cells are just created by the users,
   * so we can animate them in 🤩
   */
  let last_created_cells =
    editor_in_chief.state.field(LastCreatedCells, false) ?? [];

  let notebook = React.useMemo(() => {
    return /** @type {import("./packages/codemirror-notebook/cell").Notebook} */ ({
      id: "test",
      filename: "test",
      cell_order: EXCEL_CELLS,
      cells: Object.fromEntries(
        EXCEL_CELLS.map((cell_id) => {
          let cell_state = editor_in_chief.state.editor(cell_id);
          return [
            cell_id,
            {
              id: cell_id,
              unsaved_code: cell_state.doc.toString(),
              ...cell_state.field(CellMetaField),
            },
          ];
        })
      ),
    });
  }, [cell_editor_states, EXCEL_CELLS]);

  let notebook_with_filename = React.useMemo(() => {
    return {
      filename: "Excel",
      notebook: notebook,
    };
  }, [notebook, state.facet(NotebookFilename)]);

  let [engine, logs] = useEngine(notebook_with_filename, environment);

  return (
    <Grid>
      <thead>
        <tr>
          <th />
          {ALPHABET.split("").map((letter) => (
            <th>{letter}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chunk(EXCEL_CELLS, ALPHABET.length).map((row, i) => (
          <tr>
            <th>{i + 1}</th>
            {row
              .map((cell_id) => notebook.cells[cell_id])
              .map((cell, index) => (
                <Cell
                  key={cell.id}
                  cell_id={cell.id}
                  viewupdate={extract_nested_viewupdate(viewupdate, cell.id)}
                  cylinder={engine.cylinders[cell.id]}
                  is_selected={selected_cells.includes(cell.id)}
                  did_just_get_created={last_created_cells.includes(cell.id)}
                />
              ))}
          </tr>
        ))}
      </tbody>
    </Grid>
  );
}

let Grid = styled.table`
  padding: 10px;
  background: darkslategray;
  color: white;

  th,
  td {
    border: #e5e7eb solid 2px;
  }
  th {
    min-width: 25px;
    background-color: rgba(0, 0, 0, 0.2);
  }
  td {
    width: calc(100% / ${ALPHABET.length});
  }
`;

// @ts-ignore
import inspector_css from "./yuck/Inspector.css?inline";
// @ts-ignore
import observable_inspector from "@observablehq/inspector/src/style.css?inline";
import { AdoptStylesheet, CSSish } from "./yuck/adoptedStyleSheets";

let observable_inspector_sheet = new CSSish(observable_inspector);
let inspector_css_sheet = new CSSish(inspector_css);

let Value = ({ result }) => {
  if (result == null) return <div />;
  if (result?.type === "pending") {
    return <Inspector value={result} />;
  }

  let value = deserialize(0, result.value);
  return (
    <Inspector
      value={{
        type: "return",
        value,
      }}
    />
  );
};

/**
 * @param {{
 *  viewupdate: any;
 *  cylinder: import("./packages/codemirror-notebook/cell").CylinderShadow;
 * }} props
 */
let Cell = ({ viewupdate, cylinder }) => {
  return (
    <td className="excell">
      <AdoptStylesheet stylesheet={observable_inspector_sheet} />
      <AdoptStylesheet stylesheet={inspector_css_sheet} />

      <Value result={cylinder?.result} />
      <CodemirrorFromViewUpdate viewupdate={viewupdate} />
    </td>
  );
};
