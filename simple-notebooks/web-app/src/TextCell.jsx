import React from "react";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import {
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { EditorView } from "@codemirror/view";
import { compact } from "lodash";
import { basic_markdown_setup } from "./packages/codemirror-markdown-wysiwyg/codemirror-markdown-wysiwyg";
import { extract_nested_viewupdate } from "./packages/codemirror-editor-in-chief/editor-in-chief";
import { NudgeCell } from "./packages/codemirror-notebook/cell";

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

  "&.has-selection .cm-cursor": {
    display: "block",
  },
  "&.has-selection .cm-cursorLayer": {
    animation: "steps(1) cm-blink 1.2s infinite",
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

  React.useEffect(() => {
    for (let transaction of nested_viewupdate.transactions) {
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
  }, [nested_viewupdate.transactions]);

  return (
    <TextCellStyle
      ref={cell_wrapper_ref}
      data-cell-id={cell_id}
      className={compact([is_selected && "selected"]).join(" ")}
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

  transform: scaleX(1);
  transform-origin: top left;

  transition: filter 0.2s ease-in-out, transform 0.2s ease-in-out;

  .dragging &,
  .cell-container:has(.drag-handle:hover) &,
  .cell-container:has(.menu:focus) & {
    transform: translateX(-2px) translateY(-2px);
    z-index: 1;

    &::before {
      content: "";
      position: absolute;
      pointer-events: none;
      inset: -16px 0 -16px -16px;
      outline: solid 1px #878787;
      border-radius: 3px;

      backdrop-filter: blur(16px);
      background-color: var(
        --background-color,
        rgb(var(--background-color-rgb) / 10%)
      );
    }
  }
  /* .dragging & {
    --prexisting-transform: translateX(-2px) translateY(-2px);
    animation: shake 0.2s ease-in-out infinite alternate;
  } */
`;
