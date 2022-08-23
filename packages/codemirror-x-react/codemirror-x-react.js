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

/**
 * @typedef {{
 *  editor_state: EditorState,
 *  children: React.ReactNode,
 *  as: string,
 * } & import("react").HtmlHTMLAttributes<"div">} EditorProps
 */
export let CodeMirror = ({
  editor_state,
  children,
  as = "codemirror-editor",
  ...props
}) => {
  /** @type {React.MutableRefObject<HTMLDivElement>} */
  let dom_node_ref = React.useRef(/** @type {any} */ (null));
  /** @type {React.MutableRefObject<EditorView>} */
  let editorview_ref = React.useRef(/** @type {any} */ (null));

  /** @type {React.MutableRefObject<Array<any>>} */
  let batched_effects_ref = React.useRef([]);
  let dispatch_ref = React.useRef((...spec) => {
    // console.log(`spec:`, spec);
    batched_effects_ref.current.push(spec);
  });

  React.useLayoutEffect(() => {
    // console.log("AAAA", editor_state);
    let editorview = new EditorView({
      state: editor_state,
      parent: dom_node_ref.current,
    });
    for (let batched_effect of batched_effects_ref.current) {
      // console.log(`batched_effect:`, batched_effect);
      editorview.dispatch(...batched_effect);
    }
    dispatch_ref.current = editorview.dispatch.bind(editorview);
    editorview_ref.current = editorview;
    return () => {
      editorview.destroy();
    };
  }, [dom_node_ref, editor_state]);

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
};

export let Extension = ({ extension }) => {
  let dispatch_ref = React.useContext(codemirror_editorview_context);

  let compartment = useRef(new Compartment()).current;
  let initial_value = useRef(compartment.of(extension));

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
  }, [extension]);

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
        history(),
        // syntaxHighlighting(defaultHighlightStyle),
        // Experimental: Also add closing brackets for tripple string
        // TODO also add closing string when typing a string macro
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

        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
        EditorView.lineWrapping,
      ],
    });
  }, []);

  return state;
};
