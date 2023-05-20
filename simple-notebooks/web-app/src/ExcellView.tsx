import React from "react";
import { compact, range } from "lodash";
import styled from "styled-components";
import {
  CellMetaField,
  CylinderShadow,
  EngineShadow,
} from "./packages/codemirror-notebook/cell";
import {
  EditorInChief,
  extract_nested_viewupdate,
  EditorHasSelectionField,
} from "codemirror-editor-in-chief";

import {
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { Extension } from "codemirror-x-react";
import { Inspector } from "inspector-x-react";
import { deserialize } from "./yuck/deserialize-value-to-show.js";

export type ExcellState = EditorInChief<{ [key: string]: EditorState }>;

export function Excell({
  viewupdate,
  engine,
}: {
  viewupdate: GenericViewUpdate<ExcellState>;
  engine: EngineShadow;
}) {
  let selected_cell = viewupdate.state.field(SelectedCellField, false);
  let sheet_size = viewupdate.state.field(SheetSizeField);

  return (
    <React.Fragment>
      {/* These "are part of" the cell (more specifically, the observable inspector)
          but having them located there made updating them reeeeaallly slow
          (and there are a lot fo them) */}
      <AdoptStylesheet stylesheet={observable_inspector_sheet} />
      <AdoptStylesheet stylesheet={inspector_css_sheet} />

      <Grid
        style={{
          gridTemplateColumns: `70px repeat(${sheet_size.columns}, 100px)`,
        }}
      >
        <React.Fragment key="header">
          <div className="corner-stone" />

          {range(1, sheet_size.columns + 1).map((column) => (
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
          {range(1, sheet_size.rows + 1).map((row) => (
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

              {range(1, sheet_size.columns + 1).map((column) => {
                return (
                  <CellWrapper
                    key={column}
                    position={new SheetPosition({ column, row }, sheet_size)}
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
  position,
  selected_cell,
  viewupdate,
  cylinder,
}: {
  position: SheetPosition;
  selected_cell: { row: number; column: number };
  viewupdate: GenericViewUpdate<ExcellState>;
  cylinder: CylinderShadow;
}) => {
  let has_normal_focus =
    selected_cell?.row == position.row &&
    selected_cell?.column == position.column;
  let has_hyper_focus =
    viewupdate.state
      .editor(position.id, false)
      ?.field(EditorHasSelectionField) ?? false;

  let cell_ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (has_hyper_focus == false) {
      if (has_normal_focus) {
        cell_ref.current?.focus();
      } else {
        cell_ref.current?.blur();
      }
    }
  }, [has_normal_focus, has_hyper_focus]);

  let viewupdate_ref_for_events = React.useRef(viewupdate);
  React.useLayoutEffect(() => {
    viewupdate_ref_for_events.current = viewupdate;
  }, [viewupdate_ref_for_events, viewupdate]);

  React.useLayoutEffect(() => {
    let dom_event_handlers = viewupdate.state.facet(cellEventHandlersField);

    let unsub = [];
    for (let events of dom_event_handlers) {
      for (let [event_name, handler] of Object.entries(events)) {
        let el = cell_ref.current;
        if (el) {
          let listener = (event: Event) => {
            if (event.defaultPrevented) return;

            let viewupdate = viewupdate_ref_for_events.current;
            if (handler(event, viewupdate.view, position)) {
              event.preventDefault();
            }
          };
          el.addEventListener(event_name, listener);
          unsub.push(() => el.removeEventListener(event_name, listener));
        }
      }
    }

    return () => {
      for (let un of unsub) {
        un();
      }
    };
  }, [viewupdate.state.facet(cellEventHandlersField)]);

  return (
    <div
      key={position.id}
      id={position.id}
      tabIndex={0}
      ref={cell_ref}
      className={compact([
        "sheet-cell",
        selected_cell?.row == position.row && "active-row",
        selected_cell?.column == position.column && "active-column",
        has_normal_focus && "has-normal-focus",
        // has_hyper_focus && "has-hyper-focus",
      ]).join(" ")}
      onKeyDown={(event) => {
        if (event.defaultPrevented) {
          return;
        }
        let should_cancel = runScopeHandlers(
          // @ts-ignore
          viewupdate.view,
          event,
          // TODO Change this scope to something EditorInChief specific?
          "editor"
        );
        if (should_cancel) {
          event.preventDefault();
          return;
        }
      }}
    >
      <CellMemo
        viewupdate={extract_nested_viewupdate(viewupdate, position.id)}
        cylinder={cylinder}
      />
    </div>
  );
};

let Grid = styled.div`
  display: grid;

  grid-template-rows: 35px repeat(auto-fit, 35px);

  background: rgb(33 33 33);
  color: #ffffffcf;
  align-self: flex-start;
  flex: 1;

  width: fit-content;

  .horizontal-header,
  .vertical-header,
  .corner-stone {
    /* outline: rgb(238 238 238 / 68%) solid 1px;
    outline-offset: -1px; */

    color: #ffffffa8;
    background-color: rgb(29 29 29);
    border: 1px solid rgb(157 157 157 / 35%);

    z-index: 1;

    padding: 4px 0;

    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;

    user-select: none;
  }

  .active-header {
    font-weight: bold;
    color: #ffffffd6;
    background-color: rgb(28 48 66);
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
    /* overflow: hidden; */

    display: flex;
    flex-direction: row;
    /* align-items: center; */
    height: 35px;

    /* TODO NOT WORKING */
    scroll-margin: var(--header-height) var(--sidebar-width) 0 0;

    &:focus,
    &.has-normal-focus {
      outline: #1a99ff solid 3px;
      outline-offset: -2px;
    }

    &.sheet-cell-highlight {
      background-color: #361717;
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
      font-family: Menlo;
      /* margin-left: 6px; */
      padding-inline: 6px;
      padding-block: 5px;
    }
  }
`;

// @ts-ignore
import inspector_css from "./yuck/Inspector.css?inline";
// @ts-ignore
import observable_inspector from "@observablehq/inspector/src/style.css?inline";
import { AdoptStylesheet, CSSish } from "./yuck/adoptedStyleSheets";
import { EditorSelection, EditorState, Facet } from "@codemirror/state";
import {
  basic_sheet_setup,
  javascript_sheet_extensions,
  text_sheet_extensions,
} from "./codemirror-javascript-sheet/sheet-basics.js";
import { EditorView, ViewPlugin, runScopeHandlers } from "@codemirror/view";
import {
  SelectedCellEffect,
  SelectedCellField,
} from "./packages/codemirror-sheet/sheet-selected-cell";
import { ALPHABET } from "./packages/codemirror-sheet/alphabet";
import { SheetSizeField } from "./packages/codemirror-sheet/sheet-layout";
import { cellEventHandlersField } from "./Sheet/sheet-utils";
import { SheetPosition } from "./packages/codemirror-sheet/sheet-position";

let observable_inspector_sheet = new CSSish(observable_inspector);
let inspector_css_sheet = new CSSish(inspector_css);

let StringValue = styled.span`
  color: white;
  white-space: pre;
`;

let NumberValue = styled.span`
  color: #00a7ca;
  text-align: right;
  width: 100%;
  white-space: pre;
`;

let Value = ({ result }) => {
  if (result == null) return <div />;
  if (result?.type === "pending") {
    return (
      <div className="sheet-inspector">
        <Inspector value={result} />
      </div>
    );
  }

  let value = deserialize(0, result.value);
  if (value == null) return null;

  if (typeof value === "string") {
    return <StringValue className="sheet-inspector">{value}</StringValue>;
  }

  if (typeof value === "number") {
    return (
      <NumberValue className="sheet-inspector">{String(value)}</NumberValue>
    );
  }

  return (
    <div className="sheet-inspector">
      <Inspector
        value={{
          type: "return",
          value,
        }}
      />
    </div>
  );
};

let cell_expands_when_focused = EditorView.baseTheme({
  "&": {
    "background-color": "rgb(33, 33, 33)",
    "padding-block": "5px",
    outline: "rgb(26, 153, 255) solid 3px !important",
    "outline-offset": "-2px",

    "z-index": "3",
    height: "fit-content",
    "min-width": "fit-content",
    width: "100%",
  },
});

let editor_number_styles = [
  EditorView.baseTheme({
    "&.was-number .cm-content": {
      "text-align": "right",
    },
    "&.was-number .cm-line": {
      "padding-inline": "6px",
    },
  }),
  ViewPlugin.define((view) => {
    let was_number = view.state.facet(WasNumberFacet);
    if (was_number) {
      view.dom.classList.add("was-number");
    } else {
      view.dom.classList.remove("was-number");
    }

    return {
      update(update) {
        let was_number = update.state.facet(WasNumberFacet);
        if (was_number) {
          view.dom.classList.add("was-number");
        } else {
          view.dom.classList.remove("was-number");
        }
      },
    };
  }),
];
let WasNumberFacet = Facet.define<boolean, boolean>({
  combine: (value) => value[0],
});

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

  let code = viewupdate.state?.field(CellMetaField).code;

  let was_number = code !== "" && !Number.isNaN(Number(code));
  let was_number_extension = React.useMemo(() => {
    return WasNumberFacet.of(was_number);
  }, [was_number]);

  let language_extension = React.useMemo(() => {
    if (viewupdate?.state?.sliceDoc(0, 1) === "=") {
      return javascript_sheet_extensions;
    } else {
      return text_sheet_extensions;
    }
  }, [viewupdate?.state?.sliceDoc(0, 1)]);

  if (has_hyper_focus) {
    return (
      <CodemirrorFromViewUpdate viewupdate={viewupdate}>
        <Extension extension={basic_sheet_setup} />
        <Extension extension={language_extension} />
        <Extension extension={cell_expands_when_focused} />
        <Extension extension={was_number_extension} />
        <Extension extension={editor_number_styles} />
      </CodemirrorFromViewUpdate>
    );
  } else {
    return <Value result={cylinder?.result} />;
  }
};

let CellMemo = React.memo(Cell, (prev, next) => {
  return (
    prev.viewupdate.state === next.viewupdate.state &&
    prev.cylinder === next.cylinder
  );
});
