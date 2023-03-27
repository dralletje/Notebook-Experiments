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
} from "./syntax-highlighting.js";

export let basic_javascript_setup = [
  my_javascript_parser,
  javascript_syntax_highlighting,

  EditorState.tabSize.of(2),
  indentUnit.of("\t"),
  bracketMatching({}),
  closeBrackets(),
  highlightSelectionMatches(),
  // TODO Tab should do autocomplete when not selecting/at the beginning of a line
  keymap.of([
    {
      key: "Tab",
      run: indentMore,
      shift: indentLess,
    },
    {
      key: "Mod-d",
      run: selectNextOccurrence,
      shift: ({ state, dispatch }) => {
        if (state.selection.ranges.length === 1) return false;

        // So funny thing, the index "before" (might wrap around) the mainIndex is the one you just selected
        // @ts-ignore
        let just_selected = state.selection.ranges.at(
          state.selection.mainIndex - 1
        );

        let new_ranges = state.selection.ranges.filter(
          (x) => x !== just_selected
        );
        let new_main_index = new_ranges.indexOf(state.selection.main);

        let previous_selected = new_ranges.at(state.selection.mainIndex - 1);

        dispatch({
          selection: EditorSelection.create(new_ranges, new_main_index),
          effects:
            previous_selected == null
              ? []
              : EditorView.scrollIntoView(previous_selected.from),
        });
        return true;
      },
      preventDefault: true,
    },
  ]),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),

  awesome_line_wrapping,
];
