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
        // @ts-ignore
        // AAAAAAAA This is a hack to get EditorInChief ViewUpdates to work
        // ........ Else all keymaps will get an EditorInChief state, and they shouldn't!
        // ........ They should get a _normal_ EditorState.
        // viewupdate.view,
        {
          state: viewupdate.view.state.editorstate,
          dispatch: (...spec) => {
            viewupdate.view.dispatch(...spec);
          },
        },
        event,
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
