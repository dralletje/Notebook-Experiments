import { indentLess, indentMore } from "@codemirror/commands";
import { selectNextOccurrence } from "@codemirror/search";
import { EditorSelection } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export let cool_cmd_d = keymap.of([
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
]);
