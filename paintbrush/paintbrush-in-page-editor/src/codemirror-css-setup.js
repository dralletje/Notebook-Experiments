import { EditorState } from "@codemirror/state";
import {
  keymap,
  EditorView,
  highlightSpecialChars,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import {
  indentOnInput,
  indentUnit,
  bracketMatching,
} from "@codemirror/language";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { closeBrackets } from "@codemirror/autocomplete";
import { dot_gutter } from "./codemirror-dot-gutter";
import { dral_autocompletion } from "./dral-codemirror-autocomplete/dral-codemirror-autocomplete";
import { dral_css } from "./codemirror-css/dral-css";

let code_tab = keymap.of([
  {
    key: "Tab",
    run: indentMore,
    shift: indentLess,
  },
]);

export let basic_css_extensions = [
  EditorState.tabSize.of(2),
  indentUnit.of("\t"),
  highlightSpecialChars(),
  drawSelection(),
  awesome_line_wrapping,
  EditorState.allowMultipleSelections.of(true),
  // Multiple cursors with `alt` instead of the default `ctrl` (like vscode)
  EditorView.clickAddsSelectionRange.of(
    (event) => event.altKey && !event.shiftKey
  ),

  EditorView.theme({}, { dark: true }),
  indentOnInput(),
  closeBrackets(),
  bracketMatching(),
  dot_gutter,
  keymap.of([...defaultKeymap]),
  code_tab,

  dral_autocompletion(),
  dral_css(),
];
