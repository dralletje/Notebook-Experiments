import React from "react";
import styled, { keyframes } from "styled-components";
import { Extension } from "codemirror-x-react";
import {
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { EditorView, placeholder, ViewPlugin } from "@codemirror/view";
import { compact, isEqual, range } from "lodash";
import { shallowEqualObjects } from "shallow-equal";

import { Inspector } from "../yuck/Inspector";

import { basic_javascript_setup } from "../codemirror-javascript/codemirror-javascript";
import { EditorHasSelectionField } from "codemirror-editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
  NudgeCell,
} from "../packages/codemirror-notebook/cell";
import { default_cylinder } from "../environment/use-engine.js";
import { highlight_cell_references } from "../packages/codemirror-notebook-sheet/codemirror-notebook-sheet";

let InspectorContainer = styled.div`
  /* padding-left: calc(16px + 4px);
  padding-right: 16px; */
  overflow-y: auto;

  font-size: 16px;
  .folded & {
    min-height: 45px;
  }
`;

export let EditorStyled = styled.div`
  background-color: #141414;
  border: solid 1px #ffffff14;
`;

let pulse_animation = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 1;
  }
`;

let CellStyle = styled.div`
  flex: 1 1 0px;
  min-width: 0px;

  font-family: Menlo, "Roboto Mono", "Lucida Sans Typewriter", "Source Code Pro",
    monospace;

  &.modified {
    & ${EditorStyled} {
      background-color: rgb(14 27 39);
      border: solid 1px #778cb514;
    }
  }

  &.force-unfolded .cell-editor {
    opacity: 0.7;
  }

  position: relative;
  &::before {
    content: "";
    pointer-events: none;
    position: absolute;
    left: -10px;
    width: 5px;
    top: 0px;
    bottom: 0px;

    background-color: white;
    opacity: 0;
    border-radius: 3px;
  }

  &.error::before {
    background-color: #820209;
    opacity: 0.5;
  }
  &.pending::before {
    background-color: #4a4a4a;
    opacity: 0.5;
  }
  &.running::before {
    background-color: white;
    opacity: 0.5;
    animation: ${pulse_animation} 1s ease-in-out infinite alternate;
  }

  &.selected::after {
    content: "";
    position: absolute;
    inset: -0.26rem;
    left: -1rem;
    background-color: #20a5ba24;
    pointer-events: none;
  }

  border-radius: 3px;
  filter: drop-shadow(0 0px 0px rgba(255, 255, 255, 0));
  transform: scaleX(1);
  transform-origin: top left;

  transition: filter 0.2s ease-in-out, transform 0.2s ease-in-out,
    background-color 0.2s ease-in-out;

  background-color: var(
    --background-color,
    rgb(var(--background-color-rgb) / 10%)
  );

  .inspector-container {
    background-color: var(--background-color, rgb(var(--background-color-rgb)));
  }

  .dragging &,
  .cell-container:has(.drag-handle:hover) &,
  .cell-container:has(.menu:focus) & {
    transform: translateX(-2px) translateY(-2px);
    z-index: 1;

    /* This looks pretty nice */
    outline: solid 1px #878787;
    backdrop-filter: blur(16px);

    background-color: var(
      --background-color,
      rgb(var(--background-color-rgb) / 10%)
    );
    .inspector-container {
      background-color: var(
        --background-color,
        rgb(var(--background-color-rgb) / 10%)
      );

      & .sticky-left,
      & .sticky-right {
        &::before {
          backdrop-filter: unset;
        }
      }
    }
    .cell-editor {
      background-color: rgb(20 20 20 / 10%);
    }
  }
  .dragging & {
    --prexisting-transform: translateX(-2px) translateY(-2px);
    animation: shake 0.2s ease-in-out infinite alternate;
  }
`;

let local_style = EditorView.theme({
  "& .cm-content": {
    // margin: "16px 16px 16px 0",
    margin: "16px",
    // padding: "8px 16px 8px 0",
    padding: "0px",
  },
  // "& .cm-gutters": {
  //   margin: "16px 0 16px 0",
  //   padding: "0px",
  // },

  "& .cm-content, & .cm-scroller, & .cm-tooltip-autocomplete .cm-completionLabel":
    {
      "font-family": "inherit",
    },
  "&:focus-within  .cm-matchingBracket": {
    color: "white !important",
    fontWeight: 700,
    "background-color": "#c58c237a",
    "border-radius": "2px",
  },
  "&  .cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    height: "unset",
  },
  "&  .cm-selectionBackground": {
    background: "hsl(0deg 0% 59% / 30%)",
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "hsl(215deg 64% 59% / 48%)",
  },
  "&.cm-focused": {
    outline: "unset",
  },

  // Cursor style
  "& .cm-cursor": {
    "border-left-color": "#dcdcdc",
  },
  // Placeholder style
  "& .cm-placeholder": {
    color: "rgb(255 255 255 / 20%)",
    "font-style": "italic",
  },

  "& .cm-matchingBracket, & .cm-nonmatchingBracket": {
    "background-color": "unset",
    color: "unset",
  },
});

/** @param {Selection | null} selection */
function* ranges(selection) {
  if (selection === null) return;
  for (let index of range(0, selection.rangeCount)) {
    yield selection.getRangeAt(index);
  }
}
// Been scratching my head over this,
// but there is a difference between `focus` and `selection` it turns out...
// So as an experiment I now remove the selections in the editor when the editor loses focus.
// TODO Add this to the text editor as well
// TODO Make this a "default" behavior for the editor? Maybe even add to CodeMirror?
let remove_selection_on_blur_extension = EditorView.domEventHandlers({
  blur: (event, view) => {
    let selection = document.getSelection();
    for (let selection_range of ranges(selection)) {
      if (
        view.dom.contains(selection_range.startContainer) ||
        view.dom.contains(selection_range.endContainer)
      ) {
        selection?.removeRange(selection_range);
      }
    }
  },
});

/**
 * @param {{
 *  cell_id: import("../packages/codemirror-notebook/cell").CellId,
 *  cylinder: import("../packages/codemirror-notebook/cell").CylinderShadow,
 *  is_selected: boolean,
 *  did_just_get_created: boolean,
 *  viewupdate: GenericViewUpdate,
 * }} props
 */
export let Cell = ({
  cell_id,
  cylinder = default_cylinder(),
  is_selected,
  did_just_get_created,
  viewupdate,
}) => {
  let state = viewupdate.state;
  let type = state.facet(CellTypeFacet);
  let cell = {
    id: cell_id,
    unsaved_code: state.doc.toString(),
    ...state.field(CellMetaField),
    type: type,

    // Uhhhh TODO??
    ...(type === "text" ? { code: state.doc.toString() } : {}),
  };

  // prettier-ignore
  let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  let cell_wrapper_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (did_just_get_created) {
      cell_wrapper_ref.current.animate(
        [
          { clipPath: `inset(100% 0 0 0)`, transform: "translateY(-100%)" },
          { clipPath: `inset(0 0 0 0)`, transform: "translateY(0%)" },
        ],
        { duration: 200 }
      );
    }
  }, []);

  React.useEffect(() => {
    for (let transaction of viewupdate.transactions) {
      if (transaction.annotation(NudgeCell)) {
        cell_wrapper_ref.current.animate(
          {
            transform: [
              "translateX(0)",
              "translateX(-5px)",
              "translateX(5px)",
              "translateX(-5px)",
              "translateX(0)",
            ],
          },
          { duration: 200 }
        );
      }
    }
  }, [viewupdate.transactions]);

  // FLASH when cell is done running
  React.useLayoutEffect(() => {
    cell_wrapper_ref.current.animate(
      {
        opacity: [0, 1, 1, 1, 0.5, 0],
      },
      {
        duration: 300,
        pseudoElement: "::before",
      }
    );
  }, [cylinder.last_internal_run]);

  let [is_focused, set_is_focused] = React.useState(false);
  let set_is_focused_extension = React.useMemo(() => {
    return EditorView.domEventHandlers({
      focus: () => {
        set_is_focused(true);
      },
      blur: (event, view) => {
        set_is_focused(false);
      },
    });
  }, [set_is_focused]);

  let modified = cell.unsaved_code.trim() !== cell.code.trim();
  let folded =
    viewupdate.state.field(EditorHasSelectionField) || modified
      ? false
      : cell.folded;
  let forced_unfolded = cell.folded === true && folded === false;

  let classes = compact([
    cylinder.running && "running",
    (cylinder.waiting || cylinder.last_run < cell.requested_run_time) &&
      "pending",
    cylinder.result?.type === "throw" && "error",
    cylinder.result?.type === "return" && "success",
    folded && "folded",
    forced_unfolded && "force-unfolded",
    modified && "modified",
    is_selected && "selected",
  ]).join(" ");

  return (
    <CellStyle
      ref={cell_wrapper_ref}
      data-cell-id={cell.id}
      className={`font-mono ${classes} cell`}
    >
      <InspectorContainer className="inspector-container">
        <Inspector value={cylinder?.result} />
      </InspectorContainer>

      {/*
      TODO Would be cool to not render when folded, but for now that breaks moving
      .... into this cell from a cell above it.
      {!folded && (
        */}
      <EditorStyled
        className="cell-editor"
        style={{
          display: folded ? "none" : undefined,
          marginTop: folded ? 0 : undefined,
        }}
      >
        <CodemirrorFromViewUpdate ref={editorview_ref} viewupdate={viewupdate}>
          <Extension
            key="highlight_cell_references"
            extension={highlight_cell_references}
          />
          <Extension
            key="placeholder"
            deps={[]}
            extension={placeholder("The rest is still unwritten... ")}
          />
          <Extension
            key="basic-javascript-setup"
            extension={basic_javascript_setup}
          />
          <Extension
            key="set_is_focused_extension"
            extension={set_is_focused_extension}
          />
          <Extension
            key="remove_selection_on_blur_extension"
            extension={remove_selection_on_blur_extension}
          />
          <Extension key="local_style" extension={local_style} />
        </CodemirrorFromViewUpdate>
      </EditorStyled>
      {/* )} */}
    </CellStyle>
  );
};

// Not sure if this is useful at all, as the `Cell` is a very small component at the moment...
export let CellMemo = React.memo(
  Cell,
  (
    {
      viewupdate: old_viewupdate,
      cylinder: old_cylinder,
      cell_id: old_cell_id,
      ...old_props
    },
    { viewupdate: next_viewupdate, cylinder, cell_id, ...next_props }
  ) => {
    return (
      shallowEqualObjects(old_props, next_props) &&
      old_viewupdate.state === next_viewupdate.state &&
      isEqual(old_cylinder, cylinder)
    );
  }
);
