import React from "react";
import { produce } from "immer";
import { chunk, compact } from "lodash";
import styled from "styled-components";
import {
  EngineShadow,
  MutateCellMetaEffect,
} from "./packages/codemirror-notebook/cell";
import {
  EditorInChief,
  extract_nested_viewupdate,
  EditorHasSelectionField,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";

import {
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { Extension } from "codemirror-x-react";
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

export function Excell({
  viewupdate,
  engine,
}: {
  viewupdate: GenericViewUpdate<EditorInChief<EditorState>>;
  engine: EngineShadow;
}) {
  return (
    <React.Fragment>
      <AdoptStylesheet stylesheet={observable_inspector_sheet} />
      <AdoptStylesheet stylesheet={inspector_css_sheet} />
      <Table>
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
              {row.map((cell_id) => (
                <CellMemo
                  key={cell_id}
                  viewupdate={extract_nested_viewupdate(viewupdate, cell_id)}
                  cylinder={engine.cylinders[cell_id]}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </Table>

      {/* <Grid>
        <div className="corner" />
        {ALPHABET.split("").map((letter) => (
          <div key={letter} className="horizontal-header">
            {letter}
          </div>
        ))}
        {chunk(EXCEL_CELLS, ALPHABET.length).map((row, i) => (
          <React.Fragment key={i}>
            <div className="vertical-header">{i + 1}</div>
            {row.map((cell_id) => (
              <CellMemo
                key={cell_id}
                viewupdate={extract_nested_viewupdate(viewupdate, cell_id)}
                cylinder={engine.cylinders[cell_id]}
              />
            ))}
          </React.Fragment>
        ))}
      </Grid> */}
    </React.Fragment>
  );
}

let Grid = styled.div`
  display: grid;

  // Grid with 27 columns,
  // the first one 50 pixels wide, the rest 100 pixels wide
  grid-template-columns: 50px repeat(26, 100px);

  .horizontal-header {
    position: sticky;
    top: 0;
  }
  .vertical-header {
    position: sticky;
    left: 0;
  }
  .corner {
    position: sticky;
    top: 0;
    left: 0;
  }

  .horizontal-header,
  .vertical-header,
  .corner {
    outline: rgb(238 238 238 / 68%) solid 1px;
    outline-offset: -1px;

    min-width: 25px;
    background-color: #1c1b04;
    z-index: 1;
  }
  .corner {
    z-index: 2;
  }
`;

let Table = styled.table`
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
import { ALPHABET, EXCEL_CELLS } from "./Sheet/sheet-utils";

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

let Cell = ({
  viewupdate,
  cylinder,
}: {
  viewupdate: GenericViewUpdate<EditorState>;
  cylinder: import("./packages/codemirror-notebook/cell").CylinderShadow;
}) => {
  let has_normal_focus = viewupdate.state.field(EditorHasSelectionField, false);
  let has_hyper_focus = viewupdate.state.field(HyperfocusField, false);

  return (
    <td
      tabIndex={0}
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
      <div style={{ height: 25, width: 150 }}>
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

let CellMemo = React.memo(Cell, (prev, next) => {
  return (
    prev.viewupdate.state === next.viewupdate.state &&
    prev.cylinder === next.cylinder
  );
});
