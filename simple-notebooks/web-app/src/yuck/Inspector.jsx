import React from "react";
import styled from "styled-components";
import { Inspector as BasicInspector } from "inspector-x-react";
import { compact, isEqual } from "lodash";
import { CodeMirror, Extension } from "codemirror-x-react";
import { EditorState, Prec } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { Decoration, EditorView } from "@codemirror/view";
import { ReactWidget } from "react-codemirror-widget";
import shadow from "react-shadow";
import {
  javascript_syntax_highlighting,
  my_javascript_parser,
} from "../codemirror-javascript/syntax-highlighting";
import { CSSish, AdoptStylesheet } from "./adoptedStyleSheets";

// @ts-ignore
import inspector_css from "./Inspector.css?inline";
import observable_inspector from "@observablehq/inspector/src/style.css?inline";

let observable_inspector_sheet = new CSSish(observable_inspector);
let inspector_css_sheet = new CSSish(inspector_css);

let AAAAA = styled.div`
  & .cm-editor {
    border: none !important;
  }
  & .cm-scroller {
    padding-bottom: 8px;
    padding-top: 8px;
  }
  .folded & .cm-scroller {
    /* padding-bottom: 0px; */
  }

  & .sticky-left,
  & .sticky-right {
    position: sticky;
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;

      /* So want the sticky stuff to float above the text that will scroll underneath,
         but because the background color changes when dragging, I found that backdrop-filter
         is... the easiest? LOL  */
      /* background-color: hsl(0deg 0% 7%); */
      backdrop-filter: blur(100px);
      /* background-color: var(
        --background-color,
        rgb(var(--background-color-rgb))
      ); */
    }
  }
  & .sticky-left {
    position: sticky;
    left: 4px;
    &::before {
      left: -4px;
    }
  }
  & .sticky-right {
    position: sticky;
    right: 8px;
    &::before {
      right: -8px;
    }
  }

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
  & .cm-editor.cm-focused {
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
let PlaceInsideExpression = ({ expression, children }) => {
  let state = React.useMemo(() => {
    return EditorState.create({
      doc: expression ?? "__RESULT_PLACEHOLDER__",
      extensions: [
        EditorState.tabSize.of(4),
        indentUnit.of("\t"),
        my_javascript_parser,
        javascript_syntax_highlighting,
        EditorView.editable.of(false),
      ],
    });
  }, [expression]);

  let replace_placeholder = React.useMemo(() => {
    return Prec.lowest(
      EditorView.decorations.compute(["doc"], (state) => {
        let placeholder_index = state.doc
          .toString()
          .indexOf("__RESULT_PLACEHOLDER__");

        if (placeholder_index >= 0) {
          return Decoration.set(
            compact([
              placeholder_index === 0
                ? null
                : Decoration.mark({ class: "sticky-left" }).range(
                    0,
                    placeholder_index
                  ),
              Decoration.replace({
                widget: new ReactWidget(
                  children ?? (
                    <span style={{ color: "#229945" }}>undefined</span>
                  )
                ),
              }).range(
                placeholder_index,
                placeholder_index + "__RESULT_PLACEHOLDER__".length
              ),
              placeholder_index + "__RESULT_PLACEHOLDER__".length ===
              state.doc.length
                ? null
                : Decoration.mark({ class: "sticky-right" }).range(
                    placeholder_index + "__RESULT_PLACEHOLDER__".length,
                    state.doc.length
                  ),
            ])
          );
        }
        return Decoration.set([]);
      })
    );
  }, [children]);

  if (expression == null && children == null) {
    return null;
  }

  return (
    <AAAAA>
      <CodeMirror state={state}>
        <Extension extension={replace_placeholder} />
      </CodeMirror>
    </AAAAA>
  );
};

/** @param {{ node: Node }} props */
let Render = ({ node }) => {
  let ref = React.useRef(null);

  React.useLayoutEffect(() => {
    // @ts-ignore
    let element = /** @type {HTMLElement} */ (ref.current);
    element.appendChild(node);
    return () => {
      element.removeChild(node);
    };
  }, [node]);

  return <div style={{ display: "inline-block" }} ref={ref} />;
};

/**
 * @param {{
 *   value: any,
 *   deserialize: (value: any) => any,
 * }} props
 */
export let InspectorNoMemo = ({ value, deserialize }) => {
  let result_deserialized = React.useMemo(() => {
    if (value?.type === "return") {
      return {
        type: /** @type {const} */ ("return"),
        name: value.name,
        value: deserialize(value.value),
      };
    } else if (value?.type === "throw") {
      return {
        // Because observable inspector doesn't show the stack trace when it is a thrown value?
        // But we need to make our own custom error interface anyway (after we fix sourcemaps? Sighh)
        type: /** @type {const} */ ("return"),
        value: deserialize(value.value),
      };
    } else {
      return { type: /** @type {const} */ ("pending") };
    }
  }, [value]);

  // Explicit render HTML without a surrounding expression differently,
  // because my in-codemirror-renderer thing does _something_ odd with paddings and shit
  // AND THIS JUST WORKS PLEASE LET ME BE I'M HAPPY WITH THIS
  if (
    value?.name == null &&
    result_deserialized.type === "return" &&
    result_deserialized.value instanceof Node
  ) {
    return (
      <div style={{ display: "inline-block" }}>
        <AdoptStylesheet stylesheet={observable_inspector_sheet} />
        <AdoptStylesheet stylesheet={inspector_css_sheet} />
        <BasicInspector value={result_deserialized} />
      </div>
    );
  }

  if (
    value?.name == null &&
    result_deserialized.type === "return" &&
    result_deserialized.value === undefined
  ) {
    return null;
  }

  return (
    <PlaceInsideExpression expression={value?.name}>
      {/* <shadow.div style={{ display: "inline" }}> */}
      <AdoptStylesheet stylesheet={observable_inspector_sheet} />
      <AdoptStylesheet stylesheet={inspector_css_sheet} />
      {
        // prettier-ignore
        result_deserialized.type === "return" &&
        result_deserialized.value === undefined
        ? null 
        : result_deserialized.type === "return" &&
        result_deserialized.value instanceof Node
        ? (
          // Need to render html elements separately because HTML in Observable Inspector
          // Doesn't work nicely with my `display: inline` __RESULT_PLACEHOLDER__ replacement.
          <Render node={result_deserialized.value} />
        ) : (
          <BasicInspector value={result_deserialized} />
        )
      }
      {/* </shadow.div> */}
    </PlaceInsideExpression>
  );
};

export let Inspector = React.memo(InspectorNoMemo, (a, b) => {
  return isEqual(a.value, b.value);
});
