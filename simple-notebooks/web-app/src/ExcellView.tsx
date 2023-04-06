import React from "react";
import { produce } from "immer";
import { chunk, compact, range } from "lodash";
import styled from "styled-components";
import {
  CellMetaField,
  CylinderShadow,
  EngineShadow,
  MutateCellMetaEffect,
} from "./packages/codemirror-notebook/cell";
import {
  EditorInChief,
  extract_nested_viewupdate,
  EditorHasSelectionField,
  EditorId,
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
  let selected_cell = viewupdate.state.field(SelectedCellField, false);

  let COLUMNS = viewupdate.state.field(SheetSizeField).columns;
  let ROWS = viewupdate.state.field(SheetSizeField).rows;

  return (
    <React.Fragment>
      {/* These "are part of" the cell (more specifically, the observable inspector)
          but having them located there made updating them reeeeaallly slow
          (and there are a lot fo them) */}
      <AdoptStylesheet stylesheet={observable_inspector_sheet} />
      <AdoptStylesheet stylesheet={inspector_css_sheet} />

      <Grid
        style={{
          gridTemplateColumns: `70px repeat(${COLUMNS - 1}, 100px)`,
        }}
      >
        <React.Fragment key="header">
          <div className="corner-stone" />

          {range(1, COLUMNS).map((column) => (
            <div
              key={column}
              className={[
                "horizontal-header",
                selected_cell?.column === column && "active-header",
              ].join(" ")}
            >
              {ALPHABET[column - 1]}
            </div>
          ))}
        </React.Fragment>

        <React.Fragment key="body">
          {range(1, ROWS).map((row) => (
            <React.Fragment key={row}>
              <div
                className={[
                  "vertical-header",
                  selected_cell?.row === row && "active-header",
                ].join(" ")}
                onClick={() => {
                  viewupdate.view.dispatch({
                    effects: [SelectedCellEffect.of({ row, column: null })],
                  });
                }}
              >
                {row}
              </div>

              {range(1, COLUMNS).map((column) => {
                return (
                  <CellWrapper
                    key={column}
                    row={row}
                    column={column}
                    selected_cell={selected_cell}
                    viewupdate={viewupdate}
                    cylinder={engine.cylinders[`${ALPHABET[column - 1]}${row}`]}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </React.Fragment>
      </Grid>
    </React.Fragment>
  );
}

let CellWrapper = ({
  column,
  row,
  selected_cell,
  viewupdate,
  cylinder,
}: {
  column: number;
  row: number;
  selected_cell: { row: number; column: number };
  viewupdate: GenericViewUpdate<EditorInChief<EditorState>>;
  cylinder: CylinderShadow;
}) => {
  let cell_id = `${ALPHABET[column - 1]}${row}` as EditorId;
  // `has_normal_focus` should be replaced with actual browser focus
  let has_normal_focus =
    selected_cell?.row == row && selected_cell?.column == column;

  let cell_ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (has_normal_focus) {
      cell_ref.current?.focus();
    } else {
      cell_ref.current?.blur();
    }
  }, [has_normal_focus]);

  return (
    <div
      key={cell_id}
      tabIndex={0}
      ref={cell_ref}
      className={compact([
        "sheet-cell",
        selected_cell?.row == row && "active-row",
        selected_cell?.column == column && "active-column",
        has_normal_focus && "has-normal-focus",
        // has_hyper_focus && "has-hyper-focus",
      ]).join(" ")}
      onFocus={() => {
        viewupdate.view.dispatch({
          effects: [SelectedCellEffect.of({ row, column })],
        });
      }}
      onClick={(event) => {
        event.preventDefault();
        viewupdate.view.dispatch({
          effects: [
            SelectedCellEffect.of({
              row,
              column,
            }),
          ],
        });
      }}
      onDoubleClick={(event) => {
        if (event.defaultPrevented) return;
        // if (has_hyper_focus) return;

        event.preventDefault();
        let cell_viewupdate = extract_nested_viewupdate(viewupdate, cell_id);
        cell_viewupdate.view.dispatch({
          selection: EditorSelection.create([
            EditorSelection.cursor(cell_viewupdate.state.doc.length),
          ]),
        });
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.defaultPrevented) return;
        // if (has_hyper_focus) return;
        if (event.metaKey) return;

        if (event.key === "Enter") {
          event.preventDefault();
          let cell_viewupdate = extract_nested_viewupdate(viewupdate, cell_id);
          cell_viewupdate.view.dispatch({
            selection: EditorSelection.create([
              EditorSelection.cursor(cell_viewupdate.state.doc.length),
            ]),
          });
        } else if (event.key.length === 1) {
          event.preventDefault();
          let cell_viewupdate = extract_nested_viewupdate(viewupdate, cell_id);
          cell_viewupdate.view.dispatch({
            selection: EditorSelection.create([EditorSelection.cursor(1)]),
            changes: {
              from: 0,
              to: cell_viewupdate.state.doc.length,
              insert: event.key,
            },
          });
        } else if (event.key === "Backspace") {
          event.preventDefault();
          let cell_viewupdate = extract_nested_viewupdate(viewupdate, cell_id);
          cell_viewupdate.view.dispatch({
            changes: {
              from: 0,
              to: cell_viewupdate.state.doc.length,
              insert: "",
            },
            effects: [
              MutateCellMetaEffect.of((cell) => {
                cell.code = "";
                cell.requested_run_time = Date.now();
              }),
            ],
          });
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          viewupdate.view.dispatch({
            effects: [
              SelectedCellEffect.of({
                row: Math.max(row - 1, 0),
                column,
              }),
            ],
          });
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          viewupdate.view.dispatch({
            effects: [
              SelectedCellEffect.of({
                row: row + 1,
                column,
              }),
            ],
          });
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          viewupdate.view.dispatch({
            effects: [
              SelectedCellEffect.of({
                row,
                column: Math.max(column - 1, 0),
              }),
            ],
          });
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          viewupdate.view.dispatch({
            effects: [
              SelectedCellEffect.of({
                row,
                column: column + 1,
              }),
            ],
          });
        }
      }}
    >
      <CellMemo
        viewupdate={extract_nested_viewupdate(viewupdate, cell_id)}
        cylinder={cylinder}
      />
    </div>
  );
};

let Grid = styled.div`
  display: grid;

  grid-template-rows: 35px repeat(auto-fit, 35px);

  background: #232204;
  color: #ffffffcf;
  align-self: flex-start;
  flex: 1;

  width: fit-content;

  .horizontal-header,
  .vertical-header,
  .corner-stone {
    /* outline: rgb(238 238 238 / 68%) solid 1px;
    outline-offset: -1px; */

    background-color: rgb(29 29 29);
    border: 1px solid rgb(157 157 157 / 21%);

    z-index: 1;

    padding: 4px 0;

    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;

    user-select: none;
  }

  .active-header {
    background-color: rgb(19 60 94);
    outline: solid 1px rgb(25 81 128);
    outline-offset: -1px;
    z-index: 2;
  }

  .horizontal-header {
    position: sticky;
    top: var(--header-height);
    border-left: none;
  }
  .vertical-header {
    position: sticky;
    left: 0;
    border-top: none;
  }
  .corner-stone {
    z-index: 10;
    position: sticky;
    top: var(--header-height);
    left: 0;
  }

  .sheet-cell {
    border: 1px solid rgb(238 238 238 / 9%);
    border-width: 0 1px 1px 0;
    overflow: hidden;

    display: flex;
    flex-direction: row;
    align-items: center;
    height: 35px;

    &.has-normal-focus {
      outline: #1a99ff solid 3px;
      outline-offset: -2px;
    }
    /* &.active-row,
    &.active-column {
      background-color: #1a99ff1a;
    } */

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
      max-height: 100%;

      pointer-events: none;
      user-select: none;
      overflow: hidden;
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
import {
  ALPHABET,
  EXCEL_CELLS,
  SelectedCellEffect,
  SelectedCellField,
  SheetSizeField,
} from "./Sheet/sheet-utils";
import { default_cylinder } from "./environment/use-engine";

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
  let has_hyper_focus = viewupdate?.state?.field(EditorHasSelectionField);
  // cylinder.running ||
  // cylinder.waiting ||
  // cylinder.last_run !=
  //   viewupdate.state?.field(CellMetaField)?.requested_run_time;

  if (has_hyper_focus) {
    return (
      <CodemirrorFromViewUpdate viewupdate={viewupdate}>
        <Extension extension={basic_sheet_setup} />
      </CodemirrorFromViewUpdate>
    );
  } else {
    return (
      <div className="sheet-inspector">
        <Value result={cylinder?.result} />
      </div>
    );
  }
};

let CellMemo = React.memo(Cell, (prev, next) => {
  return (
    prev.viewupdate.state === next.viewupdate.state &&
    prev.cylinder === next.cylinder
  );
});
