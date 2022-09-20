import React, { useLayoutEffect, useRef, useMemo } from "react";
import _ from "lodash";
import styled from "styled-components";

import { EditorState, Compartment, StateEffect } from "@codemirror/state";
import {
  keymap,
  EditorView,
  highlightSpecialChars,
  drawSelection,
  placeholder,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from "@codemirror/commands";
import {
  indentOnInput,
  foldKeymap,
  bracketMatching,
} from "@codemirror/language";
import { highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets } from "@codemirror/autocomplete";

import { collab } from "@codemirror/collab";

/** @type {React.Context<React.MutableRefObject<(...spec: any[]) => void>>} */
let codemirror_editorview_context = React.createContext(
  /** @type {any} */ (null)
);

let Container = styled.div`
  height: 100%;
  display: contents;

  & .cm-editor .cm-content,
  & .cm-editor .cm-scroller,
  & .cm-editor .cm-tooltip-autocomplete .cm-completionLabel {
    font-family: inherit;
  }

  & .cm-editor .cm-content {
    padding: 2px 0px;
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
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
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

// /**
//  * @param {(tr: import("@codemirror/state").Transaction) => void} dispatch
//  * @param {import("@codemirror/state").Extension} extension
//  */
// let useCodemirrorExtension = (dispatch, extension) => {
//   let compartment = useRef(new Compartment()).current;
//   let initial_value = useRef(compartment.of(extension)); // TODO? Can move this inside the useLayoutEffect?

//   useLayoutEffect(() => {
//     dispatch_ref.current({
//       effects: StateEffect.appendConfig.of(initial_value.current),
//     });
//     return () => {
//       dispatch_ref.current({
//         // @ts-ignore
//         effects: compartment.reconfigure(null),
//       });
//     };
//   }, []);

//   useLayoutEffect(() => {
//     dispatch_ref.current?.({
//       effects: compartment.reconfigure(extension),
//     });
//   }, deps);
// };

export let CodeMirror = React.forwardRef(
  /**
   * @param {{
   *  editor_state: EditorState,
   *  children: React.ReactNode,
   *  as?: string | void,
   * } & import("react").HtmlHTMLAttributes<"div">} editor_props
   * @param {React.Ref<EditorView>} _ref
   */
  ({ editor_state, children, as = "codemirror-editor", ...props }, _ref) => {
    /** @type {React.MutableRefObject<HTMLDivElement>} */
    let dom_node_ref = React.useRef(/** @type {any} */ (null));
    /** @type {React.MutableRefObject<EditorView>} */
    let editorview_ref = React.useRef(/** @type {any} */ (null));

    /**
     * Batching events, as the first round of "adding extension" and "updating extensions" will run before "our" useLayout can run.
     * (Children's useLayout will run before ours)
     * @type {React.MutableRefObject<Array<any>>}
     */
    let batched_effects_ref = React.useRef([]);
    // prettier-ignore
    let dispatch_ref = React.useRef((/** @type {import("@codemirror/state").TransactionSpec[]} */ ...spec) => {
    batched_effects_ref.current.push(spec);
  });

    React.useLayoutEffect(() => {
      let editorview = new EditorView({
        state: editor_state,
        parent: dom_node_ref.current,
      });
      editorview_ref.current = editorview;

      // Apply effects we have collected before this mount (dispatches from child <Extension /> components)
      for (let batched_effect of batched_effects_ref.current) {
        editorview.dispatch(...batched_effect);
      }

      // Clear batched effects and bind dispatch to the editorview
      batched_effects_ref.current = [];
      dispatch_ref.current = editorview.dispatch.bind(editorview);

      return () => {
        // In the very very peculiar case that I actually want to change the `editor_state` without completely unmounting the component,
        // I again make `dispatch` go to `batched_effects`
        batched_effects_ref.current = [];
        dispatch_ref.current = (
          /** @type {import("@codemirror/state").TransactionSpec[]} */ ...spec
        ) => {
          batched_effects_ref.current.push(spec);
        };
        editorview_ref.current = /** @type {any} */ (null);
        editorview.destroy();
      };
    }, [dom_node_ref, editor_state]);

    React.useImperativeHandle(_ref, () => editorview_ref.current);

    // I have a very specific use-case where I want to not render the editor
    // ... and instead of being smart, and explicitly using a different component or a obvious prop,
    // ... I'm just going to use the `as = null` prop as a hack for this.
    if (as == null) {
      return null;
    }

    // return (
    //   <Container {...props} ref={dom_node_ref}>
    //     <codemirror_editorview_context.Provider value={dispatch_ref}>
    //       {children}
    //     </codemirror_editorview_context.Provider>
    //   </Container>
    // );
    // The above but with the JSX transpiled to React.createElement calls
    return React.createElement(
      Container,
      { ...props, ref: dom_node_ref },
      React.createElement(
        codemirror_editorview_context.Provider,
        { value: dispatch_ref },
        children
      )
    );
  }
);

/**
 * @param {{
 *  extension: import("@codemirror/state").Extension,
 *  deps?: any[],
 * }} props
 */
export let Extension = ({ extension, deps = [extension] }) => {
  let dispatch_ref = React.useContext(codemirror_editorview_context);

  let compartment = useRef(new Compartment()).current;
  let initial_value = useRef(compartment.of(extension)); // TODO? Can move this inside the useLayoutEffect?

  useLayoutEffect(() => {
    dispatch_ref.current({
      effects: StateEffect.appendConfig.of(initial_value.current),
    });
    return () => {
      dispatch_ref.current({
        // @ts-ignore
        effects: compartment.reconfigure(null),
      });
    };
  }, []);

  useLayoutEffect(() => {
    dispatch_ref.current?.({
      effects: compartment.reconfigure(extension),
    });
  }, deps);

  return null;
};

export let useEditorView = ({ code }) => {
  let state = React.useMemo(() => {
    const usesDarkTheme = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    return EditorState.create({
      doc: code,

      extensions: [
        EditorView.theme({}, { dark: usesDarkTheme }),
        highlightSpecialChars(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        // Multiple cursors with `alt` instead of the default `ctrl` (which we use for go to definition)
        EditorView.clickAddsSelectionRange.of(
          (event) => event.altKey && !event.shiftKey
        ),
        indentOnInput(),
        // history(),
        EditorState.languageData.of((state, pos, side) => {
          return [{ closeBrackets: { brackets: ["(", "[", "{"] } }];
        }),
        closeBrackets(),
        highlightSelectionMatches(),
        bracketMatching(),
        keymap.of([
          {
            key: "Tab",
            run: indentMore,
            shift: indentLess,
          },
        ]),

        keymap.of([
          ...defaultKeymap,
          // ...historyKeymap,
          ...foldKeymap,
        ]),
        EditorView.lineWrapping,
      ],
    });
  }, []);

  return state;
};
