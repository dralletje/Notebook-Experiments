import React from "react";
import { runScopeHandlers } from "@codemirror/view";
import { EditorInChief } from "codemirror-editor-in-chief";

export let codemirror_key_handler = (
  /** @type {KeyboardEvent} */ event,
  /** @type {import("codemirror-x-react/viewupdate.js").EditorView<EditorInChief>} */ view
) => {
  if (event.defaultPrevented) {
    return;
  }
  let should_cancel = runScopeHandlers(
    /** @type {any} */ (view),
    event,
    // TODO Change this scope to something EditorInChief specific?
    "editor"
  );
  if (should_cancel) {
    event.preventDefault();
  }
};

export let useCodemirrorKeyhandler = (
  /** @type {import("codemirror-x-react/viewupdate.js").EditorView<EditorInChief>} */ view
) => {
  // Use the nexus' keymaps as shortcuts!
  // This passes on keydown events from the document to the nexus for handling.
  React.useEffect(() => {
    let fn = (event) => codemirror_key_handler(event, view);
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
    };
  }, [view]);
};
