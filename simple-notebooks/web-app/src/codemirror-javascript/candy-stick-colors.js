// I want scope variables to be orange, and properties/external names to be red...
// But sometimes you have shorthand properties like `{ a }` which are both, so I have a cool decoration.
// Involves A LOT of lezer tree walking, and some css shenanigans, but it works!

import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";
import { VARIABLE_COLOR } from "./colors.js";

export let candy_stick_colors = [
  EditorView.theme({
    // More generic class that will make sure the text is overlaid on the original text
    ".before-stick-to-text::after": {
      // Need this to prevent any text-color or other text stuff to bleed through
      all: `initial`,
      font: `inherit`,

      "pointer-events": "none",
      content: "attr(data-text)",
      position: `absolute`,
      left: "0px",
      top: "-1.5px",
    },

    ".property-in-variable-out": {
      position: "relative",
      fontWeight: "bold",
    },
    ".property-in-variable-out::after": {
      "clip-path": "polygon(0 70%, 100% 35%, 100% 100%, 0% 100%)",
      color: VARIABLE_COLOR,
      "z-index": 1000,
    },
    ".variable-in-property-out": {
      position: "relative",
      fontWeight: "bold",
    },
    ".variable-in-property-out::after": {
      "clip-path": "polygon(0 0, 100% 0, 100% 35%, 0 70%)",
      color: VARIABLE_COLOR,
      "z-index": 1000,
    },

    // Not pretty, but only way I can force the property color...
    // (without having another more high precedence decorator)
    ".force-property, .force-property *": {
      // Slightly darker than .property { color }, because
      // it will likely be bold (always?) and that makes it too bright
      color: "#b30f0f !important",
    },
  }),
  DecorationsFromTree(({ cursor, mutable_decorations, doc }) => {
    if (cursor.name === "PatternProperty") {
      let node = cursor.node;
      let property = node.firstChild;

      if (property?.name !== "PropertyName") return;
      if (property.nextSibling != null) return;
      if (property.firstChild != null) return;

      mutable_decorations.push(
        Decoration.mark({
          class: "property-in-variable-out before-stick-to-text",
          attributes: {
            "data-text": doc.sliceString(property.from, property.to),
          },
        }).range(property.from, property.to)
      );
    }

    if (cursor.name === "Property") {
      let node = cursor.node;
      let property = node.firstChild;

      if (property?.name !== "PropertyDefinition") return;
      if (property.nextSibling != null) return;
      if (property.firstChild != null) return;

      mutable_decorations.push(
        Decoration.mark({
          class: "variable-in-property-out before-stick-to-text",
          attributes: {
            "data-text": doc.sliceString(property.from, property.to),
          },
        }).range(property.from, property.to)
      );
    }

    // Figured that `import { x } from "y"` also has this property/variable duality...
    // So more cool colors LETS GO
    if (cursor.name === "ImportGroup") {
      if (cursor.firstChild()) {
        try {
          // @ts-ignore skip to "{"
          if (cursor.name === "{") cursor.nextSibling();

          do {
            // @ts-ignore
            if (cursor.name === "VariableDefinition") {
              let from = cursor.from;
              let to = cursor.to;

              // Is the next node "," or EOF?
              let did_move = cursor.nextSibling();
              if (!did_move || cursor.name === "," || cursor.name === "}") {
                mutable_decorations.push(
                  Decoration.mark({
                    class: `force-property property-in-variable-out before-stick-to-text`,
                    attributes: {
                      "data-text": doc.sliceString(from, to),
                    },
                  }).range(from, to)
                );
              }
            }
            // @ts-ignore skip to ","
            while (cursor.name !== "," && cursor.nextSibling()) {}
          } while (cursor.nextSibling());
        } finally {
          cursor.parent();
        }
      }
    }

    // export { x }
    if (cursor.name === "ExportGroup") {
      if (cursor.firstChild()) {
        try {
          // @ts-ignore skip to "{"
          if (cursor.name === "{") cursor.nextSibling();
          do {
            // @ts-ignore
            if (cursor.name === "VariableName") {
              let from = cursor.from;
              let to = cursor.to;

              // Is the next node "," or EOF?
              let did_move = cursor.nextSibling();
              if (!did_move || cursor.name === "," || cursor.name === "}") {
                mutable_decorations.push(
                  Decoration.mark({
                    class: `force-property variable-in-property-out before-stick-to-text`,
                    attributes: {
                      "data-text": doc.sliceString(from, to),
                    },
                  }).range(from, to)
                );
              }
            }

            // lezer/javascript doesn't give me a way to style `x` and `y` in `export { x as y }` separately...
            // So I have to do this hacky thing
            while (
              // @ts-ignore
              cursor.name !== "," &&
              // @ts-ignore
              cursor.name !== "VariableName" &&
              cursor.nextSibling()
            ) {}
            // @ts-ignore
            if (cursor.name === "VariableName") {
              mutable_decorations.push(
                Decoration.mark({
                  class: `force-property`,
                }).range(cursor.from, cursor.to)
              );
            }

            // @ts-ignore Skip to next ","
            while (cursor.name !== "," && cursor.nextSibling()) {}
          } while (cursor.nextSibling());
        } finally {
          cursor.parent();
        }
      }
    }

    // Turns out, `export let x = 10` is ALSO a property/variable duality
    // ExportDeclaration/VariableDeclaration/VariableDefinition
    if (cursor.name === "ExportDeclaration" && cursor.firstChild()) {
      try {
        do {
          // @ts-ignore
          if (cursor.name === "VariableDeclaration" && cursor.firstChild()) {
            try {
              do {
                // @ts-ignore
                if (cursor.name === "VariableDefinition") {
                  if (cursor.from !== cursor.to) {
                    mutable_decorations.push(
                      Decoration.mark({
                        class: `force-property variable-in-property-out before-stick-to-text`,
                        attributes: {
                          "data-text": doc.sliceString(cursor.from, cursor.to),
                        },
                      }).range(cursor.from, cursor.to)
                    );
                  }
                }
              } while (cursor.nextSibling());
            } finally {
              cursor.parent();
            }
          }
        } while (cursor.nextSibling());
      } finally {
        cursor.parent();
      }
    }
  }),
];
