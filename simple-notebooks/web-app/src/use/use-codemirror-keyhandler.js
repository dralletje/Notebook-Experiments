import React from "react";
import { runScopeHandlers } from "@codemirror/view";

export let useCodemirrorKeyhandler = (viewupdate) => {
  // Use the nexus' keymaps as shortcuts!
  // This passes on keydown events from the document to the nexus for handling.
  React.useEffect(() => {
    let fn = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      let should_cancel = runScopeHandlers(
        viewupdate.view,
        event,
        // TODO Change this scope to something EditorInChief specific?
        "editor"
      );
      if (should_cancel) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
    };
  }, [viewupdate.view]);
};
