/**
 * All the stuff that makes a codemirror work normally for my setup.
 * So no links to the notebooks state, no fancy facets, just the basics.
 */

import { indentUnit, bracketMatching } from "@codemirror/language";

import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  selectNextOccurrence,
} from "@codemirror/search";
import {
  javascript_syntax_highlighting,
  my_javascript_parser,
} from "../codemirror-javascript/syntax-highlighting.js";

export let basic_sheet_setup = [
  my_javascript_parser,
  javascript_syntax_highlighting,

  EditorState.tabSize.of(2),
  // indentUnit.of("\t"),
  bracketMatching({}),
  closeBrackets(),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),
];
