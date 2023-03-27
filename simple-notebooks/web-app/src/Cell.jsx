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

import { Inspector } from "./yuck/Inspector";

import { basic_javascript_setup } from "./codemirror-javascript/codemirror-javascript";
import {
  EditorHasSelectionField,
  extract_nested_viewupdate,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
} from "./packages/codemirror-notebook/cell";

let InspectorContainer = styled.div`
  /* padding-left: calc(16px + 4px);
  padding-right: 16px; */
  overflow-y: auto;

  font-size: 16px;
  .folded & {
    min-height: 55px;
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

  /* background-color: rgba(0, 0, 0, 0.4); */
  /* I like transparency better for when the backdrop color changes
     but it isn't great when dragging */
  /* background-color: #121212; */

  font-family: Menlo, "Roboto Mono", "Lucida Sans Typewriter", "Source Code Pro",
    monospace;

  & ${InspectorContainer} {
    transition: all 0.2s ease-in-out;
  }
  &.modified {
    & ${EditorStyled} {
      background-color: rgb(14 27 39);
      border: solid 1px #778cb514;
    }
    & ${InspectorContainer} {
      transition: all 1s ease-in-out;
      /* opacity: 0.3; */
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
    /* right: 100%; */
    top: 0px;
    bottom: 0px;
  }

  &.error::before {
    background-color: #820209;
  }
  &.pending::before {
    background-color: #4a4a4a;
  }
  &.running::before {
    background-color: white;
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
  /* box-shadow: rgba(255, 255, 255, 0) 0px 0px 20px; */
  filter: drop-shadow(0 0px 0px rgba(255, 255, 255, 0));
  transform: scaleX(1);
  transform-origin: top left;

  transition: filter 0.2s ease-in-out, transform 0.2s ease-in-out,
    background-color 0.2s ease-in-out;

  .dragging &,
  .cell-container:has(.drag-handle:hover) &,
  .cell-container:has(.menu:focus) & {
    /* box-shadow: rgba(255, 255, 255, 0.1) 0px 0px 20px; */
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.1));
    /* transform: scaleX(1.05); */
    transform: translateX(-2px) translateY(-2px);
    z-index: 1;

    background-color: #121212;
  }
  .dragging & {
    --prexisting-transform: translateX(-2px) translateY(-2px);
    animation: shake 0.2s ease-in-out infinite alternate;
  }
`;

let local_style = EditorView.theme({
  "& .cm-content": {
    padding: "16px !important",
  },
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

/** @returns {import("./packages/codemirror-notebook/notebook-types").CylinderShadow} */
let default_cylinder = () => {
  return {
    last_run: -Infinity,
    result: { type: "return", value: { 0: { type: "undefined", value: "" } } },
    running: false,
    waiting: false,
  };
};

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
 *  cell_id: import("./packages/codemirror-notebook/notebook-types").CellId,
 *  cylinder: import("./packages/codemirror-notebook/notebook-types").CylinderShadow,
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
  let nested_viewupdate = extract_nested_viewupdate(viewupdate, cell_id);
  let state = nested_viewupdate.state;
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

  // NOTE Can also use EditorHasSelectionField, but that will keep the cell open
  // .... when I click somewhere else... but it now closes abruptly... hmmmm
  // let folded = state.field(EditorHasSelectionField) ? false : cell.folded;
  let folded = nested_viewupdate.state.field(EditorHasSelectionField)
    ? false
    : cell.folded;
  let forced_unfolded = cell.folded && is_focused;

  return (
    <CellStyle
      ref={cell_wrapper_ref}
      data-cell-id={cell.id}
      className={compact([
        cylinder.running && "running",
        (cylinder.waiting ||
          (cylinder.last_run ?? -Infinity) < (cell.last_run ?? -Infinity)) &&
          "pending",
        cylinder.result?.type === "throw" && "error",
        cylinder.result?.type === "return" && "success",
        folded && "folded",
        forced_unfolded && "force-unfolded",
        cell.unsaved_code !== cell.code && "modified",
        is_selected && "selected",
      ]).join(" ")}
    >
      <InspectorContainer>
        <Inspector value={cylinder?.result} />
      </InspectorContainer>

      {!folded && (
        <EditorStyled
          className="cell-editor"
          style={{
            display: folded ? "none" : undefined,
            marginTop: folded ? 0 : undefined,
          }}
        >
          <CodemirrorFromViewUpdate
            ref={editorview_ref}
            viewupdate={nested_viewupdate}
          >
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
      )}
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
      old_viewupdate.state.editor(cell_id) ===
        next_viewupdate.state.editor(cell_id) &&
      isEqual(old_cylinder, cylinder)
    );
  }
);
