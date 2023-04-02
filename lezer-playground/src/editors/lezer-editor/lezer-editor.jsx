import { Decoration, EditorView } from "@codemirror/view";
import React from "react";
import { base_extensions } from "../shared.js";
import { lezer_syntax_extensions } from "./lezer-extensions.js";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { Extension } from "codemirror-x-react";
import { CodemirrorFromViewUpdate } from "codemirror-x-react/viewupdate";

const NO_EXTENSIONS = [];

let position_from_error = (error) => {
  let position_stuff = error?.message?.match?.(/^[^(]* \((\d+):(\d+)\)$/);

  if (position_stuff) {
    let [_, _line, _column] = position_stuff;
    let line = Number(_line);
    let column = Number(_column);
    return { line, column };
  } else {
    return null;
  }
};

/**
 * @param {{
 *  viewupdate: import("codemirror-x-react/viewupdate").GenericViewUpdate,
 *  result: import("../../use/OperationMonadBullshit.js").ExecutionResult<any>,
 *  error: Error?
 * }} props
 */
export let LezerEditor = ({ viewupdate, result, error }) => {
  let error_extension = React.useMemo(() => {
    if (error != null) {
      let position = position_from_error(error);
      if (position) {
        let { line, column } = position;
        return EditorView.decorations.of((view) => {
          try {
            let line_start = view.state.doc.line(line).from;
            return Decoration.set(
              Decoration.mark({
                class: "programming-error-oops",
              }).range(line_start + column, line_start + column + 1)
            );
          } catch (error) {
            console.error("Derp:", error);
            return Decoration.none;
          }
        });
      }
    }
    return NO_EXTENSIONS;
  }, [error]);

  return (
    <CodemirrorFromViewUpdate viewupdate={viewupdate}>
      <Extension extension={base_extensions} />
      <Extension extension={lezer_syntax_extensions} />
      <Extension extension={awesome_line_wrapping} />
      <Extension extension={error_extension} />
    </CodemirrorFromViewUpdate>
  );
};
