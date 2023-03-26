import React from "react";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import {
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { EditorView } from "@codemirror/view";
import { compact } from "lodash";
import { basic_markdown_setup } from "./yuck/basic-markdown-setup";
import { useNestedViewUpdate } from "./packages/codemirror-editor-in-chief/editor-in-chief";

export let EditorStyled = styled.div`
  /* background-color: rgba(0, 0, 0, 0.4); */
  /* background-color: rgb(23 23 23 / 40%); */
  background-color: #141414;
  & .cm-content {
    padding: 16px !important;
  }
`;

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
    inset: -0.5rem;
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
