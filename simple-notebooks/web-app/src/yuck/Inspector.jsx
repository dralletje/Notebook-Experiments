import React from "react";
import styled from "styled-components";
import { Inspector as BasicInspector } from "inspector-x-react";
import "@observablehq/inspector/src/style.css";
import { compact, isEqual } from "lodash";
import { deserialize } from "./deserialize-value-to-show";
import { CodeMirror, Extension } from "codemirror-x-react";
import { EditorState, Prec } from "@codemirror/state";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { javascript_syntax_highlighting } from "../javascript/codemirror-javascript-setup";
import { javascript } from "@codemirror/lang-javascript";
import { Decoration, EditorView } from "@codemirror/view";
import { ReactWidget } from "react-codemirror-widget";

let InspectorStyle = styled.div`
  --syntax_normal: #848484;
  --syntax_comment: #747474;
  --syntax_number: #00ca5a;
  --syntax_keyword: #008c85; /* Or white? */
  --syntax_atom: #10a778;
  --syntax_string: #00ca5a;
  --syntax_error: #ffbedc;
  --syntax_unknown_variable: #838383;
  --syntax_known_variable: #ff7a6f;
  --syntax_matchbracket: #20bbfc;
  --syntax_key: #f91515;

  display: contents;

  & svg {
    display: inline;
  }

  /* For some, weird reason, this rule isn't 
            in the open source version */
  & .observablehq--caret {
    margin-right: 4px;
    vertical-align: baseline;
  }

  & .observablehq--inspect {
    /* Makes the whole inspector flow like text */
    display: inline;
    font-size: 16px;
  }
  /* Add a gimmicky javascript logo */
  & .observablehq--inspect.observablehq--collapsed > a::before,
  & .observablehq--inspect:not(.observablehq--collapsed)::before,
  & .observablehq--running::before {
    all: initial;
    content: "JS";
    color: #323330;
    background-color: #f0db4f;
    display: inline-block;
    padding-left: 4px;
    padding-right: 4px;
    padding-top: 3px;
    padding-bottom: 2px;
    margin-right: 8px;
    font-size: 14px;
    font-family: "Roboto Mono";
    font-weight: bold;
    margin-bottom: 3px;

    /* Hmmm, undo the logo sorry sorry */
    content: unset;
  }
`;

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
`;
let PlaceInsideExpression = ({ expression, children }) => {
  let state = React.useMemo(() => {
    return EditorState.create({
      doc: expression ?? "__RESULT_PLACEHOLDER__",
      extensions: [
        EditorState.tabSize.of(4),
        indentUnit.of("\t"),
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
                widget: new ReactWidget(children),
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
      <CodeMirror state={state} style={{ border: "none" }}>
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

  return <div ref={ref} />;
};

export let InspectorNoMemo = ({ value }) => {
  let result_deserialized = React.useMemo(() => {
    if (value?.type === "return") {
      return {
        type: /** @type {const} */ ("return"),
        name: value.name,
        value: deserialize(0, value.value),
      };
    } else if (value?.type === "throw") {
      return {
        // Because observable inspector doesn't show the stack trace when it is a thrown value?
        // But we need to make our own custom error interface anyway (after we fix sourcemaps? Sighh)
        type: /** @type {const} */ ("return"),
        value: deserialize(0, value.value),
      };
    } else {
      return { type: /** @type {const} */ ("pending") };
    }
  }, [value]);

  // if (
  //   result_deserialized.type === "return" &&
  //   result_deserialized.value instanceof Node
  // ) {
  //   return <Render node={result_deserialized.value} />;
  // }

  return (
    <PlaceInsideExpression expression={value?.name}>
      {result_deserialized.type === "return" &&
      result_deserialized.value === undefined ? null : (
        <InspectorStyle>
          <BasicInspector value={result_deserialized} />
        </InspectorStyle>
      )}
    </PlaceInsideExpression>
  );
};

export let Inspector = React.memo(InspectorNoMemo, (a, b) => {
  return isEqual(a.value, b.value);
});
