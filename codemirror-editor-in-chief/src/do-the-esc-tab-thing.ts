import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

// Want to do codemirror-approved tab handling,
// so when you press Escape and then Tab, it will escape the editor.
// But I want to go even further: I want the keep escape pressed and jump through editors.
// Which the default codemirror tab handling doesn't do. #teamnotebook
// https://codemirror.net/examples/tab/

// TODO Doesn't do anything yet, because I can't actually block events from being handled in the editor.
// .... So I need to create a new field/facet to block events manually.
// .... Luckily, I am in control of everything so yeah I can do that 😎

let handle_tab_ref = {
  escape_is_pressed: false,
  timeout: null as unknown as ReturnType<typeof setTimeout>,
};
export let escape_handler_keymap = Prec.highest(
  EditorView.domEventHandlers({
    keydown: (event, view) => {
      if (event.key === "Escape") {
        clearTimeout(handle_tab_ref.timeout);
        handle_tab_ref.escape_is_pressed = true;
      }

      if (event.key === "Tab") {
        if (handle_tab_ref.escape_is_pressed) {
          return true;
        }
      }
    },
    keyup: (event, view) => {
      if (event.key === "Escape") {
        handle_tab_ref.timeout = setTimeout(() => {
          handle_tab_ref.escape_is_pressed = false;
        }, 100);
      }
    },
  })
);
