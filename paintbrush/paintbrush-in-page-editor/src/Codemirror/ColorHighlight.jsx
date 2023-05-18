import { Decoration } from "@codemirror/view";
import {
  ask_css_to_sanitize_color,
  ColorPickerWidget,
} from "@dral/codemirror-subtle-color-picker";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

export let decorate_colors = DecorationsFromTree(
  ({ cursor, mutable_decorations, doc }) => {
    if (
      cursor.name === "ValueName" ||
      cursor.name === "CallExpression" ||
      cursor.name === "ColorLiteral"
    ) {
      let text_from = cursor.from;
      let text_to = cursor.to;

      let text = doc.sliceString(text_from, text_to);
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
  }
);
