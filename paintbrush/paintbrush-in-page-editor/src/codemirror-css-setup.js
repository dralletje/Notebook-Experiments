import { EditorState } from "@codemirror/state";
import {
  keymap,
  EditorView,
  highlightSpecialChars,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import {
  indentOnInput,
  indentUnit,
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches } from "@codemirror/search";
import { css, cssLanguage } from "@codemirror/lang-css";
import { closeBrackets, autocompletion } from "@codemirror/autocomplete";

export const css_colors = HighlightStyle.define(
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
    {
      tag: tags.comment,
      color: "var(--cm-comment-color)",
      fontStyle: "italic",
    },
  ],
  {
    scope: cssLanguage,
    all: { color: "var(--cm-css-color)" },
  }
);

export let basic_css_extensions = [
  EditorState.tabSize.of(2),
  indentUnit.of("\t"),
  highlightSpecialChars(),
  drawSelection(),
  EditorView.lineWrapping,

  EditorState.allowMultipleSelections.of(true),
  // Multiple cursors with `alt` instead of the default `ctrl` (like vscode)
  EditorView.clickAddsSelectionRange.of(
    (event) => event.altKey && !event.shiftKey
  ),

  history(),
  indentOnInput(),
  closeBrackets(),
  highlightSelectionMatches(),
  bracketMatching(),
  autocompletion({}),
  keymap.of([...defaultKeymap, ...historyKeymap]),

  css(),
  syntaxHighlighting(css_colors),
];
