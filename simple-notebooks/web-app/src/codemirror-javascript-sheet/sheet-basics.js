/**
 * All the stuff that makes a codemirror work normally for my setup.
 * So no links to the notebooks state, no fancy facets, just the basics.
 */

import { bracketMatching } from "@codemirror/language";

import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  javascript_syntax_highlighting,
  my_javascript_parser,
} from "../codemirror-javascript/syntax-highlighting.js";

export let javascript_sheet_extensions = [
  my_javascript_parser,
  javascript_syntax_highlighting,
];

export let text_sheet_extensions = [
  EditorView.baseTheme({
    "&": {
      color: "white",
    },
  }),
];

export let basic_sheet_setup = [
  EditorState.tabSize.of(2),
  bracketMatching({}),
  closeBrackets(),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),
];
