import React from "react";
import styled from "styled-components";

import { CodeMirror, useEditorView, Extension } from "../codemirror-x-react.js";
import {
  Decoration,
  EditorView,
  placeholder,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import {
  HighlightStyle,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import {
  debug_syntax_plugin,
  iterate_with_cursor,
} from "../debug-syntax-plugin.js";
import { EditorState, Facet, StateField, Prec } from "@codemirror/state";

import { foldGutter, FoldComponentFacet } from "./fold.tsx";

import { ReactWidget, useEditorView } from "react-codemirror-widget";

export { FoldComponentFacet };

export let value_to_codemirror_text = ({
  heap,
  id,
  anti_recursion_stack = [],
}) => {
  let next_anti_recursion_stack = [id, ...anti_recursion_stack];
  let go_deeper = (x) =>
    value_to_codemirror_text({
      heap,
      id: x,
      anti_recursion_stack: next_anti_recursion_stack,
    });
  let { value, type } = heap[id];

  let result_itself = (() => {
    if (anti_recursion_stack.includes(id)) {
      return `RECURSION(${id})`;
    } else {
      if (type === "number") {
        return JSON.stringify(value);
      } else if (type === "string") {
        return JSON.stringify(value);
      } else if (type === "function") {
        return value.body;
      } else if (type === "symbol") {
        return `Symbol(${JSON.stringify(value)})`;
      } else if (type === "array") {
        return `[${value.map(go_deeper).join(", ")}]`;
      } else if (type === "map") {
        return `new Map([${value
          .map(
            ({ key, value }) =>
              `[ /* Key */ ${go_deeper(key)}, /* Value */ ${go_deeper(value)}]`
          )
          .join(", ")}])`;
      } else if (type === "date") {
        let date = new Date(value);
        return `new Date(${JSON.stringify(date.toISOString())})`;
      } else if (type === "object") {
        let possibly_html = value.find(
          (x) =>
            heap[x.key].type === "string" &&
            heap[x.key].value === "$html" &&
            heap[x.value].type === "string"
        );
        if (possibly_html) {
          return `HTML(${JSON.stringify(heap[possibly_html.value].value)})`;
        }

        return `{
        ${value
          .map(({ key, value }) => `[${go_deeper(key)}]: ${go_deeper(value)}`)
          .join(", ")}
      }`;
      } else {
        return `types.${type}(${JSON.stringify(value)})`;
      }
    }
  })();

  return `HEAP[${id}](${result_itself})`;
};

/**
 * @typedef InputVariableDescription
 * @type {{
 *  name: string,
 *  color: string,
 * }}
 */

let get_heap_call = (code) => {
  let match = code.match(/^HEAP\[(\d+)\]$/);
  return match?.[1];
};

class StringWidget extends WidgetType {
  constructor(string) {
    super();
    this.string = string;
  }

  toDOM(view) {
    this.view = view;
    let span = document.createElement("x-cool");
    span.style.display = "inline-block";
    span.innerHTML = this.string;
    return span;
  }
}

/**
 * @param {EditorState} state
 * @param {Array<InputVariableDescription>} events
 */
let get_variable_marks = (state, events) => {
  let decos = [];
  iterate_with_cursor({
    tree: syntaxTree(state),
    enter: (cursor) => {
      if (cursor.name === "CallExpression") {
        let callee = cursor.node.firstChild;
        let name = state.sliceDoc(callee.from, callee.to);

        let heap_index = get_heap_call(name);
        if (heap_index != null) {
          decos.push(Decoration.replace({}).range(callee.from, callee.to));
          decos.push(Decoration.replace({}).range(callee.to, callee.to + 1));
          decos.push(Decoration.replace({}).range(cursor.to - 1, cursor.to));

          // TODO Put this in a facet instead
          decos.push(
            Decoration.mark({
              attributes: {
                "data-heap": heap_index,
                "data-heap-from": cursor.from,
                "data-heap-to": cursor.to,
              },
            }).range(cursor.from, cursor.to)
          );
        }

        if (name === "RECURSION") {
          let hopefully_head_id = callee.nextSibling.firstChild.nextSibling;
          let head_id = state.sliceDoc(
            hopefully_head_id.from,
            hopefully_head_id.to
          );
          decos.push(
            Decoration.replace({
              widget: new ReactWidget(<Recursion id={head_id} />),
            }).range(cursor.from, cursor.to)
          );
        }

        if (name === "HTML") {
          let hopyfully_html_node = callee.nextSibling.firstChild.nextSibling;
          let hopefully_html = state.sliceDoc(
            hopyfully_html_node.from + 1,
            hopyfully_html_node.to - 1
          );
          decos.push(
            Decoration.replace({
              widget: new StringWidget(hopefully_html),
            }).range(cursor.from, cursor.to)
          );
        }
      }
      return;
    },
  });
  return Decoration.set(decos, true);
};

let Recursion = ({ id }) => {
  let view = useEditorView();
  return (
    <span
      onClick={(event) => {
        // Select value it refers to?
        let heap_data = event.currentTarget
          .closest(".cm-editor")
          .querySelector(`[data-heap="${id}"]`);
        if (heap_data) {
          let from = Number(heap_data.dataset.heapFrom);
          let to = Number(heap_data.dataset.heapTo);

          view.dispatch({
            selection: { anchor: from, head: to },
          });
        }
      }}
      style={{
        borderRadius: 4,
        paddingLeft: 8,
        paddingRight: 8,
        backgroundColor: "red",
        cursor: "pointer",
      }}
    >
      Recursion!
    </span>
  );
};

/**
 * @param {Array<InputVariableDescription>} input_variables
 */
export const hide_heap_references_extension = StateField.define({
  create() {
    return Decoration.none;
  },
  update(prev, update) {
    if (
      update.docChanged ||
      update.viewportChanged ||
      prev === Decoration.none
    ) {
      return get_variable_marks(update.state, update.view);
    } else {
      return prev;
    }
  },
  provide: (f) => EditorView.decorations.from(f),
});

export let ValueEditor = ({}) => {
  return (
    <>
      <Extension extension={Prec.highest(foldGutter())} />
      <Extension extension={hide_heap_references_extension} />
    </>
  );
};

// let CssEditorFoldedStyled = styled(CssEditorStyled)`
//   background-color: red;
//   display: inline-block;

//   & .cm-editor {
//     padding: 0;
//   }
// `;

// export let FoldedValue = ({ value, children }) => {
//   let editor_state = useEditorView({
//     code: value
//   });
//   return (
//     <CssEditorFoldedStyled>
//       <CodeMirror editor_state={editor_state}>
//         <Extension extension={javascript()} />

//         <Extension extension={syntax_colors} />
//         <Extension extension={debug_syntax_plugin} />
//         <Extension extension={hide_heap_references_extension} />
//         <Extension extension={EditorView.editable.of(false)} />

//         {children}
//       </CodeMirror>
//     </CssEditorFoldedStyled>
//   );
// };
