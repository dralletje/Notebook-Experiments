import React from "react";
import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";
import { CodemirrorFromViewUpdate } from "codemirror-x-react/viewupdate";
import { Extension } from "codemirror-x-react";

import {
  ask_css_to_sanitize_color,
  ColorPickerWidget,
  // @ts-ignore
} from "@dral/codemirror-subtle-color-picker";
import { base_extensions } from "../shared.js";
import { basic_javascript_setup } from "../../should-be-shared/codemirror-javascript-setup.js";

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

let javascript_specific_extension = [
  DecorationsFromTree(({ cursor, mutable_decorations, doc }) => {
    if (cursor.name === "String") {
      let text_from = cursor.from + 1;
      let text_to = cursor.to - 1;

      let text = doc.sliceString(text_from, text_to);
      if (text.startsWith(" ") || text.endsWith(" ")) return;
      let color = ask_css_to_sanitize_color(text);

      if (color != "") {
        mutable_decorations.push(
          Decoration.widget({
            block: false,
            widget: new ColorPickerWidget(text_from, text_to, color),
          }).range(text_from)
        );
      }
    }
  }),
];

/** @param {{ viewupdate: import("codemirror-x-react/viewupdate").GenericViewUpdate, error: Error? }} props */
export let JavascriptStuffEditor = ({ viewupdate, error }) => {
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
      <Extension extension={basic_javascript_setup} />
      <Extension extension={javascript_specific_extension} />
      <Extension extension={error_extension} />
    </CodemirrorFromViewUpdate>
  );
};
