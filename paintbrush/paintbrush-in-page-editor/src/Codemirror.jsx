import React, { useLayoutEffect, useRef, useMemo } from "react";
import _ from "lodash";

import { html } from "htm/react";

import { EditorState, Compartment, StateEffect } from "@codemirror/state";
import {
  keymap,
  EditorView,
  highlightSpecialChars,
  drawSelection,
  placeholder,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import {
  indentOnInput,
  indentUnit,
  foldKeymap,
  bracketMatching,
  defaultHighlightStyle,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { css, cssLanguage } from "@codemirror/lang-css";
import { closeBrackets, autocompletion } from "@codemirror/autocomplete";

import "./editor.css";

export const pluto_syntax_colors_css = HighlightStyle.define(
  [
    {
      tag: tags.propertyName,
      color: "var(--cm-css-accent-color)",
      fontWeight: 700,
    },
    {
      tag: tags.variableName,
      color: "var(--cm-css-accent-color)",
      fontWeight: 700,
    },
    { tag: tags.definitionOperator, color: "var(--cm-css-color)" },
    { tag: tags.keyword, color: "var(--cm-css-color)" },
    { tag: tags.modifier, color: "var(--cm-css-accent-color)" },
    { tag: tags.punctuation, opacity: 0.5 },
    { tag: tags.literal, color: "var(--cm-css-color)" },
    // { tag: tags.unit, color: "var(--cm-css-accent-color)" },
    { tag: tags.tagName, color: "var(--cm-css-color)", fontWeight: 700 },
    {
      tag: tags.className,
      color: "red",
    },
    {
      tag: tags.constant(tags.className),
      color: "var(--cm-css-why-doesnt-codemirror-highlight-all-the-text-aaa)",
    },

    // Comment from julia
    {
      tag: tags.comment,
      color: "var(--cm-comment-color)",
      fontStyle: "italic",
    },
  ],
  {
    scope: cssLanguage,
    // But the css-lang packaged isn't in codemirror pluto setup and I can't be arsed now.
    all: { color: "var(--cm-css-color)" },
  }
);

export const pluto_syntax_colors = HighlightStyle.define(
  [
    { tag: tags.propertyName, color: "var(--cm-property-color)" },
    { tag: tags.unit, color: "var(--cm-tag-color)" },
    { tag: tags.literal, color: "var(--cm-builtin-color)", fontWeight: 700 },
    { tag: tags.macroName, color: "var(--cm-macro-color)", fontWeight: 700 },
    {
      tag: tags.standard(tags.variableName),
      color: "var(--cm-builtin-color)",
      fontWeight: 700,
    },

    { tag: tags.bool, color: "var(--cm-builtin-color)", fontWeight: 700 },

    { tag: tags.keyword, color: "var(--cm-keyword-color)" },
    {
      tag: tags.comment,
      color: "var(--cm-comment-color)",
      fontStyle: "italic",
    },
    { tag: tags.atom, color: "var(--cm-atom-color)" },
    { tag: tags.number, color: "var(--cm-number-color)" },
    // { tag: tags.property, color: "#48b685" },
    // { tag: tags.attribute, color: "#48b685" },
    { tag: tags.keyword, color: "var(--cm-keyword-color)" },
    { tag: tags.string, color: "var(--cm-string-color)" },
    { tag: tags.variableName, color: "var(--cm-var-color)", fontWeight: 700 },
    // { tag: tags.variable2, color: "#06b6ef" },
    { tag: tags.typeName, color: "var(--cm-type-color)", fontStyle: "italic" },
    {
      tag: tags.typeOperator,
      color: "var(--cm-type-color)",
      fontStyle: "italic",
    },
    { tag: tags.bracket, color: "var(--cm-bracket-color)" },
    { tag: tags.brace, color: "var(--cm-bracket-color)" },
    { tag: tags.tagName, color: "var(--cm-tag-color)" },
    { tag: tags.link, color: "var(--cm-link-color)" },
    {
      tag: tags.invalid,
      color: "var(--cm-error-color)",
      background: "var(--cm-error-bg-color)",
    },
  ],
  {
    all: { color: `var(--cm-editor-text-color)` },
    scope: cssLanguage,
  }
);

export let useEditorState = ({ code }) => {
  let state = React.useMemo(() => {
    const usesDarkTheme = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    return EditorState.create({
      doc: code,

      extensions: [
        EditorView.theme({}, { dark: usesDarkTheme }),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        // Multiple cursors with `alt` instead of the default `ctrl` (which we use for go to definition)
        EditorView.clickAddsSelectionRange.of(
          (event) => event.altKey && !event.shiftKey
        ),
        indentOnInput(),
        // syntaxHighlighting(defaultHighlightStyle),
        // Experimental: Also add closing brackets for tripple string
        // TODO also add closing string when typing a string macro
        EditorState.languageData.of((state, pos, side) => {
          return [{ closeBrackets: { brackets: ["(", "[", "{"] } }];
        }),
        closeBrackets(),
        // closeBrackets(),
        // rectangularSelection({
        //   eventFilter: (e) => e.altKey && e.shiftKey && e.button == 0,
        // }),
        highlightSelectionMatches(),
        bracketMatching(),
        css(),
        EditorState.tabSize.of(2),
        indentUnit.of("\t"),

        autocompletion({}),

        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
        syntaxHighlighting(pluto_syntax_colors_css),
        EditorView.lineWrapping,
      ],
    });
  }, []);

  return state;
};
