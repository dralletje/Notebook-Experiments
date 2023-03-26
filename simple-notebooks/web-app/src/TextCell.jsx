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
import { useNestedViewUpdate } from "./packages/codemirror-editor-in-chief/editor-in-chief";

/**
 * @param {{
 *  cell_id: import("./notebook-types").CellId,
 *  cell: import("./notebook-types").Cell,
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
  let nested_viewupdate = useNestedViewUpdate(viewupdate, cell_id);

  // prettier-ignore
  let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));

  /** @type {import("react").MutableRefObject<HTMLDivElement>} */
  let cell_wrapper_ref = React.useRef(/** @type {any} */ (null));
  React.useEffect(() => {
    if (did_just_get_created) {
      cell_wrapper_ref.current.animate(
        [
          {
            clipPath: `inset(100% 0 0 0)`,
            transform: "translateY(-100%)",
          },
          {
            clipPath: `inset(0 0 0 0)`,
            transform: "translateY(0%)",
          },
        ],
        {
          duration: 200,
        }
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

  /*********** UHHHHHHHH **********/

  --cm-editor-text-color: #008c85;
  --cm-matchingBracket-color: white;
  --cm-matchingBracket-bg-color: #c58c237a;
  --cm-placeholder-text-color: rgb(255 255 255 / 20%);
  --cm-selection-background: hsl(215deg 64% 59% / 48%);
  --cm-selection-background-blurred: hsl(0deg 0% 59% / 30%);

  & .cm-editor .cm-content,
  & .cm-editor .cm-scroller,
  & .cm-editor .cm-tooltip-autocomplete .cm-completionLabel {
    font-family: inherit;
  }

  &:focus-within .cm-editor .cm-matchingBracket {
    color: var(--cm-matchingBracket-color) !important;
    font-weight: 700;
    background-color: var(--cm-matchingBracket-bg-color);
    border-radius: 2px;
  }

  & .cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li {
    height: unset;
  }

  & .cm-editor .cm-selectionBackground {
    background: var(--cm-selection-background-blurred);
  }
  & .cm-editor.cm-focused .cm-selectionBackground {
    background: var(--cm-selection-background);
  }

  & .cm-editor {
    color: var(--cm-editor-text-color);
  }
  & .cm-editor.cm-focused:not(.__) {
    outline: unset;
  }

  & .cm-selectionMatch {
    background: none !important;
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
  }
  @media (prefers-color-scheme: dark) {
    & .cm-selectionMatch {
      background: none !important;
      text-shadow: 0 0 13px rgb(255 255 255);
    }
  }

  & .cm-editor .cm-matchingBracket,
  & .cm-editor .cm-nonmatchingBracket {
    background-color: unset;
    color: unset;
  }

  & .cm-editor .cm-placeholder {
    color: var(--cm-placeholder-text-color);
    font-style: italic;
  }

  /* HEYYYYY */
  & .cm-editor {
    height: 100%;
  }

  & .cm-cursor {
    border-left-color: #dcdcdc !important;
  }
`;
