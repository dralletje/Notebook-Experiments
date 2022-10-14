/**
 * All the stuff that makes a codemirror work normally for my setup.
 * So no links to the notebooks state, no fancy facets, just the basics.
 */

import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  bracketMatching,
  LanguageSupport,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import { javascriptLanguage, tsxLanguage } from "@codemirror/lang-javascript";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { StyleModule } from "style-mod";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  selectNextOccurrence,
} from "@codemirror/search";

import { styleTags, tags as t } from "@lezer/highlight";
import { DecorationsFromTree } from "./basic-markdown-setup";

export const customJsHighlight = styleTags({
  Equals: t.definitionOperator,
  "JSXAttribute/JSXIdentifier": t.attributeName,
  "JSXAttribute/Equals": t.punctuation,
  // I need to override JSXMemberEpxression.JSXIdentifier for my whole decoration trick
  "JSXMemberExpression/JSXIdentifier": t.special(t.tagName),

  // TODO Make this... a little bit more beautiful than just BAM HERE TYPE
  "TypeAliasDeclaration/...": t.typeName,

  // TODO So this one is odd:
  // .... lezer/javascript currently thinks that for `class X extends Y`, `Y` is a `TypeName`
  // .... but it should be a `VariableName`!! It can't even be a type ever... I think?
  // .... Fix in lezer/javascript
  "ClassDeclaration/TypeName": t.className,

  // Wanted to do just '"!"' but that didn't work?
  "UnaryExpression/LogicOp": t.special(t.logicOperator),
  // ? and ! aren't logic operators??
  "ConditionalExpression/LogicOp": t.controlOperator,

  // TODO Was hoping to do this, but it didn't work
  // .... Meant to style the outer quotes of a string literal with a bit of opacity.
  // .... Either fix this in lezer/javascript or just do decorations manually
  'String/"\\""': t.punctuation,
});

let syntax_classes = new StyleModule({
  ".very-important": {
    color: "white",
    fontWeight: 700,
  },
  ".important": {
    color: "white",
  },
  ".boring": {
    // color: "#008c85",
    color: "#787878",
  },

  ".property": {
    color: "#f91515",
  },
  ".variable": {
    color: "#ff7a6f",
    fontWeight: 700,
  },
  ".literal": {
    color: "#00ca5a",
  },
  ".comment": {
    color: "#747474",
    fontStyle: "italic",
  },
});

const syntax_colors = HighlightStyle.define(
  [
    { tag: tags.string, class: "literal" },
    { tag: tags.bool, class: "literal", fontWeight: 700 },
    { tag: tags.number, class: "literal" },
    { tag: tags.literal, class: "literal", fontWeight: 700 },
    { tag: tags.null, class: "literal" },

    { tag: tags.keyword, class: "boring" },

    { tag: tags.variableName, class: "variable" },
    { tag: tags.className, class: "variable" },
    { tag: tags.propertyName, class: "property" },
    { tag: tags.comment, class: "comment" },

    { tag: tags.special(tags.brace), fontWeight: 700 },

    // super
    { tag: tags.atom, class: "important" },
    // this
    { tag: tags.self, class: "important" },

    // { tag: tags.property, color: "#48b685" },
    // { tag: tags.attribute, color: "#48b685" },
    // { tag: tags.variable2, color: "#06b6ef" },
    { tag: tags.typeName, color: "var(--cm-type-color)", fontStyle: "italic" },

    // ,
    { tag: tags.punctuation, class: "boring" },

    // =
    { tag: tags.definitionOperator, class: "very-important" },
    // =>
    { tag: tags.function(tags.punctuation), class: "very-important" },
    // += -= *= /= ??=
    { tag: tags.updateOperator, class: "important" },

    { tag: tags.bracket, class: "boring" },
    { tag: tags.brace, class: "boring" },

    // Catch all for operators
    { tag: tags.operator, class: "important" },
    // .
    { tag: tags.derefOperator, class: "boring" },
    // + - * /
    { tag: tags.arithmeticOperator, class: "important" },
    // === !==
    { tag: tags.compareOperator, class: "important" },
    // && ||
    { tag: tags.logicOperator, class: "important" },
    // TODO Maybe make `!` even more emphasized? Make sure it is hard to miss
    // !
    { tag: tags.special(t.logicOperator), class: "very-important" },
    // export import
    { tag: tags.moduleKeyword, class: "important" },
    // if else while break continue
    { tag: tags.controlKeyword, class: "very-important" },
    // ? :
    { tag: tags.controlOperator, class: "very-important" },

    // JSX
    { tag: tags.content, class: "literal" },
    { tag: tags.attributeValue, class: "literal" },
    { tag: tags.angleBracket, class: "boring" },
    { tag: tags.attributeName, class: "property" },
    { tag: tags.special(tags.tagName), class: "variable" },

    // Ideally tags.standard(tags.tagName) would work, but it doesn't....
    // Still putting it here just for kicks, but lezer doesn't differentiate between builtin tags and Component names...
    { tag: tags.standard(tags.tagName), class: "literal" },
    // So instead I handle this manually with decorations in `lowercase_jsx_identifiers`,
    // and I "clear" `tags.tagName` here so that it doesn't get styled as a variable
    { tag: tags.tagName, class: "" },
    // But I do need the variables inside `JSXMemberExpression` to get styled so...
    { tag: tags.special(tags.tagName), class: "variable" },
  ],
  {
    // all: { color: `var(--cm-editor-text-color)` },
    scope: javascriptLanguage,
  }
);

let my_javascript_parser = new LanguageSupport(
  tsxLanguage.configure({
    props: [customJsHighlight],
  })
);

// TODO Another that I can't do here: Fix the fact that `<div />` and `<Inspector />`
// .... both get JSXIdentifier now, where it should treat the lowercase one different.
// .... Either fix this in lezer/javascript or just do decorations manually
let lowercase_jsx_identifiers = DecorationsFromTree(
  ({ cursor, mutable_decorations, doc }) => {
    if (cursor.name === "JSXMemberExpression") {
      // This is like <mod.component /> which is an expression even though it has no capital letter,
      // but I don't want to style the insides like literal so I stop digging.
      return false;
    }
    if (cursor.node.parent?.name === "JSXAttribute") {
      return;
    }

    if (cursor.name === "JSXIdentifier") {
      console.log("???", mutable_decorations);
      let text = doc.sliceString(cursor.from, cursor.to);
      if (text[0] === text[0].toLowerCase()) {
        mutable_decorations.push(
          Decoration.mark({
            class: "literal",
          }).range(cursor.from, cursor.to)
        );
      } else {
        mutable_decorations.push(
          Decoration.mark({
            class: "variable",
          }).range(cursor.from, cursor.to)
        );
      }
    }
  }
);

// TODO Can't currently distinguish between `x` in `{ x: y } = z` and `{ x } = z` :(
// .... (I want the former to be a `PatternProperty` and the latter to be a `VariableName`,
// .... but they're both `PatternProperty` right now)
// .... Guess this one NEEDS decorations?
let wtf_is_this = [
  EditorView.styleModule.of(
    new StyleModule({
      // More generic class that will make sure the text is overlaid on the original text
      ".before-stick-to-text::before": {
        // Need this to prevent any text-color or other text stuff to bleed through
        all: `initial`,
        font: `inherit`,

        "pointer-events": "none",
        content: "attr(data-text)",
        position: `absolute`,
        left: "0px",
        bottom: "-2px",
      },

      ".property-in-variable-out": {
        position: "relative",
        fontWeight: "bold",
      },
      ".property-in-variable-out::before": {
        "clip-path": "polygon(0 70%, 100% 35%, 100% 100%, 0% 100%)",
        color: "#ff7a6f",
        "z-index": 1000,
      },
      ".variable-in-property-out": {
        position: "relative",
        fontWeight: "bold",
      },
      ".variable-in-property-out::before": {
        "clip-path": "polygon(0 0, 100% 0, 100% 35%, 0 70%)",
        color: "#ff7a6f",
        "z-index": 1000,
      },
    })
  ),
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
  }),
];

export let javascript_syntax_highlighting = [
  Prec.lowest(wtf_is_this),
  syntaxHighlighting(syntax_colors),
  EditorView.styleModule.of(syntax_classes),
  my_javascript_parser,
  lowercase_jsx_identifiers,
];

export let basic_javascript_setup = [
  EditorState.tabSize.of(2),
  indentUnit.of("\t"),
  javascript_syntax_highlighting,
  placeholder("The rest is still unwritten..."),
  bracketMatching({}),
  closeBrackets(),
  highlightSelectionMatches(),
  // TODO Tab should do autocomplete when not selecting/at the beginning of a line
  keymap.of([
    {
      key: "Tab",
      run: indentMore,
      shift: indentLess,
    },
    {
      key: "Mod-d",
      run: selectNextOccurrence,
      shift: ({ state, dispatch }) => {
        if (state.selection.ranges.length === 1) return false;

        // So funny thing, the index "before" (might wrap around) the mainIndex is the one you just selected
        // @ts-ignore
        let just_selected = state.selection.ranges.at(
          state.selection.mainIndex - 1
        );

        let new_ranges = state.selection.ranges.filter(
          (x) => x !== just_selected
        );
        let new_main_index = new_ranges.indexOf(state.selection.main);

        let previous_selected = new_ranges.at(state.selection.mainIndex - 1);

        console.log(`new_ranges:`, new_ranges);
        dispatch({
          selection: EditorSelection.create(new_ranges, new_main_index),
          effects:
            previous_selected == null
              ? []
              : EditorView.scrollIntoView(previous_selected.from),
        });
        return true;
      },
      preventDefault: true,
    },
  ]),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),

  awesome_line_wrapping,
];
