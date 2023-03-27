import React from "react";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import {
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { EditorView } from "@codemirror/view";
import { compact } from "lodash";
import { basic_markdown_setup } from "./codemirror-markdown/codemirror-markdown";
import { extract_nested_viewupdate } from "./packages/codemirror-editor-in-chief/editor-in-chief";

let local_style = EditorView.theme({
  "& .cm-scroller": {
    "font-family": "inherit",
  },
  "&:focus-within  .cm-matchingBracket": {
    color: "white !important",
    fontWeight: 700,
    "background-color": "#c58c237a",
    "border-radius": "2px",
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

/**
 * @param {{
 *  cell_id: import("./packages/codemirror-notebook/cell").CellId,
 *  is_selected: boolean,
 *  did_just_get_created: boolean,
 *  viewupdate: GenericViewUpdate,
 * }} props
 */
export let TextCell = ({
  cell_id,
  is_selected,
  did_just_get_created,
  viewupdate,
}) => {
  let nested_viewupdate = extract_nested_viewupdate(viewupdate, cell_id);

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

  return (
    <TextCellStyle
      ref={cell_wrapper_ref}
      data-cell-id={cell_id}
      className={compact([is_selected && "selected", "cell-editor"]).join(" ")}
    >
      <CodemirrorFromViewUpdate
        ref={editorview_ref}
        viewupdate={nested_viewupdate}
      >
        <Extension key="markdown-setup" extension={basic_markdown_setup} />
        <Extension key="local_style" extension={local_style} />
      </CodemirrorFromViewUpdate>
    </TextCellStyle>
  );
};

let TextCellStyle = styled.div`
  flex: 1 1 0px;
  min-width: 0px;

  font-family: system-ui;
  font-size: 1.2em;

  position: relative;

  padding-left: 16px;

  &.selected::after {
    content: "";
    position: absolute;
    inset: -0.26rem;
    left: -1rem;
    background-color: #20a5ba24;
    pointer-events: none;
  }

  .cm-scroller {
    overflow: visible;
  }

  border-radius: 3px;
  /* box-shadow: rgba(255, 255, 255, 0) 0px 0px 20px; */
  filter: drop-shadow(0 0px 0px rgba(255, 255, 255, 0));
  transform: scaleX(1);
  transform-origin: top left;

  transition: filter 0.2s ease-in-out, transform 0.2s ease-in-out;

  .dragging &,
  .cell-container:has(.drag-handle:hover) &,
  .cell-container:has(.menu:focus) & {
    /* box-shadow: rgba(255, 255, 255, 0.1) 0px 0px 20px; */
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.1));
    /* transform: scaleX(1.05); */
    transform: translateX(-2px) translateY(-2px);
    z-index: 1;
  }
  .dragging & {
    --prexisting-transform: translateX(-2px) translateY(-2px);
    animation: shake 0.2s ease-in-out infinite alternate;
  }
`;
