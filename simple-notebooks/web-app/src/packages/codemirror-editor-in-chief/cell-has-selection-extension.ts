import { EditorView, ViewPlugin } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

export let EditorHasSelectionEffect = StateEffect.define<boolean>();
export let EditorHasSelectionField = StateField.define<boolean>({
  create() {
    return false;
  },
  update(value, transaction) {
    for (let effect of transaction.effects) {
      if (effect.is(EditorHasSelectionEffect)) {
        value = effect.value;
      }
    }
    return value;
  },
});

export let cell_has_selection_extension = [
  EditorHasSelectionField,
  EditorView.editorAttributes.of((view) => {
    let has_selection = view.state.field(EditorHasSelectionField);
    return { class: has_selection ? "has-selection" : "" };
  }),
  ViewPlugin.define((view) => {
    let has_selection = view.state.field(EditorHasSelectionField);
    if (has_selection === true) {
      Promise.resolve().then(() => {
        // Make sure the editor isn't removed yet :O
        if (view.dom.isConnected) {
          view.focus();
        }
      });
    }

    return {
      update: (update) => {
        let had_selection = update.startState.field(EditorHasSelectionField);
        let needs_selection = update.state.field(EditorHasSelectionField);
        if (had_selection !== needs_selection) {
          let has_focus = view.dom.contains(document.activeElement);
          if (has_focus === needs_selection) return;

          if (needs_selection) {
            try {
              // TODO Somehow this crashes when the backspace-merge-with-previous-cell happens...
              // .... Yet.. it works fine ?!
              update.view.focus();
            } catch (e) {}
          } else {
            update.view.dom.blur();
          }
        }
      },
    };
  }),
  EditorView.baseTheme({
    "&:not(.has-selection) .cm-selectionBackground": {
      // Need to figure out what precedence I should give this thing so I don't need !important
      opacity: 0,
    },
  }),
];
