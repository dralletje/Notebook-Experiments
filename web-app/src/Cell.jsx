import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { HighlightStyle, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { iterate_with_cursor } from "dral-lezer-helpers";
import { EditorState, Facet, Prec } from "@codemirror/state";
import { isEqual } from "lodash";

export const syntax_colors = HighlightStyle.define(
  [
    { tag: tags.propertyName, color: "var(--cm-property-color)" },
    { tag: tags.unit, color: "var(--cm-tag-color)" },
    { tag: tags.literal, color: "var(--cm-builtin-color)", fontWeight: 700 },
    { tag: tags.macroName, color: "var(--cm-macro-color)", fontWeight: 700 },
    {
      tag: tags.standard(tags.variableName),
      color: "var(--cm-builtin-color)",
      fontWeight: 700,
    },

    { tag: tags.bool, color: "var(--cm-builtin-color)", fontWeight: 700 },

    { tag: tags.keyword, color: "var(--cm-keyword-color)" },
    {
      tag: tags.comment,
      color: "var(--cm-comment-color)",
      fontStyle: "italic",
    },
    { tag: tags.atom, color: "var(--cm-atom-color)" },
    { tag: tags.number, color: "var(--cm-number-color)" },
    // { tag: tags.property, color: "#48b685" },
    // { tag: tags.attribute, color: "#48b685" },
    { tag: tags.keyword, color: "var(--cm-keyword-color)" },
    { tag: tags.string, color: "var(--cm-string-color)" },
    { tag: tags.variableName, color: "var(--cm-var-color)", fontWeight: 700 },
    // { tag: tags.variable2, color: "#06b6ef" },
    { tag: tags.typeName, color: "var(--cm-type-color)", fontStyle: "italic" },
    {
      tag: tags.typeOperator,
      color: "var(--cm-type-color)",
      fontStyle: "italic",
    },
    { tag: tags.bracket, color: "var(--cm-bracket-color)" },
    { tag: tags.brace, color: "var(--cm-bracket-color)" },
    { tag: tags.tagName, color: "var(--cm-tag-color)" },
    { tag: tags.link, color: "var(--cm-link-color)" },
    {
      tag: tags.invalid,
      color: "var(--cm-error-color)",
      background: "var(--cm-error-bg-color)",
    },
  ],
  {
    all: { color: `var(--cm-editor-text-color)` },
    scope: javascriptLanguage,
  }
);

/**
 * @typedef InputVariableDescription
 * @type {{
 *  name: string,
 *  color: string,
 * }}
 */

/**
 * @param {EditorState} state
 * @param {Array<InputVariableDescription>} events
 */
let get_variable_marks = (state, events) => {
  let decos = [];
  iterate_with_cursor({
    tree: syntaxTree(state),
    enter: (cursor) => {
      if (cursor.name === "VariableName") {
        let name = state.sliceDoc(cursor.from, cursor.to);
        let event = events.find((e) => e.name === name);
        if (!event) return;
        decos.push(
          Decoration.mark({
            // TODO This used to be tagName: "a", but codemirror doesn't like that...
            // .... https://github.com/fonsp/Pluto.jl/issues/1790
            // .... Ideally we'd change it back to `a` (feels better), but functionally there is no difference..
            // .... When I ever happen to find a lot of time I can spend on this, I'll debug and change it back to `a`
            tagName: "architect-input-variable",
            attributes: {
              title: `Hey!`,
              "data-pluto-variable": state.sliceDoc(cursor.from, cursor.to),
              href: `#${name}`,
              style: "--input-variable-color: " + event.color,
            },
          }).range(cursor.from, cursor.to)
        );
      }
      return;
    },
  });
  return Decoration.set(decos);
};

/**
 * @type {Facet<Array<InputVariableDescription>, Array<InputVariableDescription>>}
 */
export const InputVariablesFacet = Facet.define({
  combine: (values) => values[0],
  compare: isEqual,
});

/**
 * @param {Array<InputVariableDescription>} input_variables
 */
export const input_variables_extension = ViewPlugin.fromClass(
  class {
    /**
     * @param {EditorView} view
     */
    constructor(view) {
      let input_variables = view.state.facet(InputVariablesFacet);
      this.decorations = get_variable_marks(view.state, input_variables);
    }

    update(update) {
      // My best take on getting this to update when GlobalDefinitionsFacet does 🤷‍♀️
      let input_variables = update.state.facet(InputVariablesFacet);
      if (
        update.docChanged ||
        update.viewportChanged ||
        input_variables !== update.startState.facet(InputVariablesFacet)
      ) {
        this.decorations = get_variable_marks(update.state, input_variables);
      }
    }
  },
  {
    decorations: (v) => v.decorations,

    eventHandlers: {
      pointerdown: (event, view) => {
        if (
          event.metaKey &&
          event.button === 0 &&
          event.target instanceof Element
        ) {
          console.log("COOOOOOLLLL");
        }
      },
    },
  }
);
