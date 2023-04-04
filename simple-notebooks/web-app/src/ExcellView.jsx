import React from "react";
import { produce } from "immer";
import { chunk, compact, range } from "lodash";
import styled from "styled-components";
import {
  CellMetaField,
  CellTypeFacet,
  MutateCellMetaEffect,
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
import { NotebookView } from "./Notebook/NotebookView";
import { cell_keymap } from "./packages/codemirror-sheet/sheet-keymap.js";
// import { typescript_extension } from "./packages/typescript-server-webworker/codemirror-typescript.js";
import {
  EditorInChief,
  EditorExtension,
  EditorInChiefKeymap,
  EditorIdFacet,
  extract_nested_viewupdate,
  EditorHasSelectionField,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import { LastCreatedCells } from "./packages/codemirror-notebook/last-created-cells.js";

import { WorkerEnvironment } from "./environment/WorkerEnvironment";
import {
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
  useViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { Extension } from "codemirror-x-react";
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
let create_cell_state = (editorstate, cell) => {
  return editorstate.create_section_editor({
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
      HyperfocusField,
      cell_keymap,
    ],
  });
};

// const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALPHABET = "ABCDEF";
// @ts-ignore
let EXCEL_CELLS =
  /** @type {import("./packages/codemirror-editor-in-chief/editor-in-chief").EditorId[]} */ (
    range(1, 10).flatMap((i) => ALPHABET.split("").map((j) => `${j}${i}`))
  );

let notebook_to_state = () => {
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

      // sheet_keymap,
      // EditorExtension.of(cell_keymap),
      // notebook_keymap,

      // This works so smooth omg
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
    ],
  });
};

export function Excell() {
  let [state, set_state] = React.useState(() => notebook_to_state());
  let environment = React.useRef(WorkerEnvironment).current;

  let viewupdate = useViewUpdate(state, /** @type {any} */ (set_state));
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
  }, [notebook]);

  let [engine, logs] = useEngine(notebook_with_filename, environment);

  return (
    <Grid>
      <thead>
        <tr>
          <td />
          {ALPHABET.split("").map((letter) => (
            <th key={letter}>{letter}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chunk(EXCEL_CELLS, ALPHABET.length).map((row, i) => (
          <tr key={i}>
            <th>{i + 1}</th>
            {row
              .map((cell_id) => notebook.cells[cell_id])
              .map((cell, index) => (
                <Cell
                  key={cell.id}
                  // cell_id={cell.id}
                  viewupdate={extract_nested_viewupdate(viewupdate, cell.id)}
                  cylinder={engine.cylinders[cell.id]}
                  // is_selected={selected_cells.includes(cell.id)}
                  // did_just_get_created={last_created_cells.includes(cell.id)}
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
  background: #232204;
  color: #ffffffcf;
  height: auto;
  align-self: flex-start;
  flex: 1;

  th,
  thead td {
    outline: rgb(238 238 238 / 68%) solid 1px;
    outline-offset: -1px;

    min-width: 25px;
    background-color: #1c1b04;
    z-index: 1;
    position: sticky;
  }
  thead {
    td {
      z-index: 2;
      left: 0;
      top: 0;
    }
    th {
      top: 0;
    }
  }
  tbody {
    th {
      left: 0;
    }
  }

  td {
    border: 1px solid rgb(238 238 238 / 17%);
    width: calc(100% / ${ALPHABET.length});
    min-width: 50px;
    max-width: 200px;
    overflow: hidden;

    &.has-normal-focus {
      outline: #1a99ff solid 3px;
      outline-offset: -2px;
    }

    .cm-editor {
      .cm-content {
        padding: 0;
        font-size: 17px;
        font-family: Menlo;
      }
      .cm-cursor {
        border-left-color: #dcdcdc !important;
      }
      .cm-scroller {
        line-height: unset;
      }

      .cm-selectionBackground {
        background-color: #3a3829;
      }
      &.cm-focused .cm-selectionBackground {
        background-color: #45411e;
      }
    }
    .sheet-inspector {
      pointer-events: none;
      user-select: none;
      overflow: auto;
      font-size: 17px;
      margin-left: 6px;
    }
  }
`;

// @ts-ignore
import inspector_css from "./yuck/Inspector.css?inline";
// @ts-ignore
import observable_inspector from "@observablehq/inspector/src/style.css?inline";
import { AdoptStylesheet, CSSish } from "./yuck/adoptedStyleSheets";
import { EditorSelection, EditorState } from "@codemirror/state";
import { basic_sheet_setup } from "./codemirror-javascript-sheet/sheet-basics.js";
import {
  HyperfocusEffect,
  HyperfocusField,
} from "./packages/codemirror-sheet/hyperfocus";

let observable_inspector_sheet = new CSSish(observable_inspector);
let inspector_css_sheet = new CSSish(inspector_css);

let Value = ({ result }) => {
  if (result == null) return <div />;
  if (result?.type === "pending") {
    return <Inspector value={result} />;
  }

  let value = deserialize(0, result.value);
  if (value == null) return null;

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
 *  viewupdate: GenericViewUpdate<EditorState>;
 *  cylinder: import("./packages/codemirror-notebook/cell").CylinderShadow;
 * }} props
 */
let Cell = ({ viewupdate, cylinder }) => {
  let has_normal_focus = viewupdate.state.field(EditorHasSelectionField, false);
  let has_hyper_focus = viewupdate.state.field(HyperfocusField, false);

  return (
    <td
      tabIndex={-1}
      className={compact([
        "excell",
        has_normal_focus && "has-normal-focus",
        has_hyper_focus && "has-hyper-focus",
      ]).join(" ")}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        if (has_hyper_focus) return;

        event.preventDefault();
        viewupdate.view.dispatch({
          selection: EditorSelection.create([
            EditorSelection.cursor(viewupdate.state.doc.length),
          ]),
        });
      }}
      onDoubleClick={(event) => {
        if (event.defaultPrevented) return;
        if (has_hyper_focus) return;

        event.preventDefault();
        viewupdate.view.dispatch({
          selection: EditorSelection.create([
            EditorSelection.cursor(viewupdate.state.doc.length),
          ]),
          effects: [HyperfocusEffect.of(true)],
        });
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (has_hyper_focus) return;
        if (event.metaKey) return;

        if (event.key === "Enter") {
          event.preventDefault();
          viewupdate.view.dispatch({
            selection: EditorSelection.create([
              EditorSelection.cursor(viewupdate.state.doc.length),
            ]),
            effects: [HyperfocusEffect.of(true)],
          });
        } else if (event.key.length === 1) {
          event.preventDefault();
          viewupdate.view.dispatch({
            selection: EditorSelection.create([EditorSelection.cursor(1)]),
            changes: {
              from: 0,
              to: viewupdate.state.doc.length,
              insert: event.key,
            },
            effects: [HyperfocusEffect.of(true)],
          });
        } else if (event.key === "Backspace") {
          event.preventDefault();
          viewupdate.view.dispatch({
            selection: EditorSelection.create([EditorSelection.cursor(0)]),
            changes: {
              from: 0,
              to: viewupdate.state.doc.length,
              insert: "",
            },
            effects: [
              MutateCellMetaEffect.of((cell) => {
                cell.code = "";
                cell.requested_run_time = Date.now();
              }),
            ],
          });
        }
      }}
    >
      <div style={{ height: 25, width: 200 }}>
        <AdoptStylesheet stylesheet={observable_inspector_sheet} />
        <AdoptStylesheet stylesheet={inspector_css_sheet} />

        {has_hyper_focus ? (
          <CodemirrorFromViewUpdate viewupdate={viewupdate}>
            <Extension extension={basic_sheet_setup} />
          </CodemirrorFromViewUpdate>
        ) : (
          <div className="sheet-inspector">
            <Value result={cylinder?.result} />
          </div>
        )}
      </div>
    </td>
  );
};
