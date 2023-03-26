import {
  HighlightStyle,
  syntaxHighlighting,
  LanguageSupport,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { Prec } from "@codemirror/state";
import { javascriptLanguage, tsxLanguage } from "@codemirror/lang-javascript";
import { Decoration, EditorView } from "@codemirror/view";

import { styleTags, tags as t } from "@lezer/highlight";
import { DecorationsFromTree } from "@dral/codemirror-helpers";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { candy_stick_colors } from "./candy-stick-colors.js";
import {
  BORING_COLOR,
  COMMENT_COLOR,
  IMPORTANT_COLOR,
  LITERAL_COLOR,
  PROPERTY_COLOR,
  TYPE_COLOR,
  VARIABLE_COLOR,
} from "./colors.js";

const customJsHighlight = styleTags({
  Equals: t.definitionOperator,
  "JSXAttribute/JSXIdentifier": t.attributeName,
  "JSXAttribute/Equals": t.punctuation,
  // I need to override JSXMemberEpxression.JSXIdentifier for my whole decoration trick
  "JSXMemberExpression/JSXIdentifier": t.special(t.tagName),

  // Make `import { x as y } from "z"` treat `x` as a property and `y` as a variable
  "ImportGroup/VariableName": t.propertyName,
  "ImportGroup/VariableDefinition": t.variableName,
  "ExportGroup/VariableName": t.variableName,

  // ???
  VariableName: t.variableName,
  "CallExpression/VariableName TaggedTemplateExpression/VariableName":
    t.function(t.variableName),
  VariableDefinition: t.definition(t.variableName),
  Label: t.labelName,
  PropertyName: t.propertyName,
  PrivatePropertyName: t.special(t.propertyName),
  "CallExpression/MemberExpression/PropertyName": t.function(t.propertyName),
  "FunctionDeclaration/VariableDefinition": t.function(
    t.definition(t.variableName)
  ),
  "ClassDeclaration/VariableDefinition": t.definition(t.className),

  "ImportDeclaration/type": t.moduleKeyword,

  // TODO Make this... a little bit more beautiful than just BAM HERE TYPE
  // "TypeAliasDeclaration/...": t.typeName,
  "TypeAliasDeclaration/...": t.special(t.typeName),
  "TypeAnnotation/...": t.special(t.typeName),
  "ParameterizedType/...": t.typeName,
  TypeName: t.typeName,

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

let syntax_classes = EditorView.theme({
  ".very-important": {
    color: IMPORTANT_COLOR,
    fontWeight: 700,
  },
  ".important": {
    color: IMPORTANT_COLOR,
  },
  ".boring": {
    // color: "#008c85",
    color: BORING_COLOR,
  },

  ".property": {
    color: PROPERTY_COLOR,
  },
  ".variable": {
    color: VARIABLE_COLOR,
    fontWeight: 700,
  },
  ".literal": {
    color: LITERAL_COLOR,
  },
  ".comment": {
    color: COMMENT_COLOR,
    fontStyle: "italic",
  },
  ".type": {
    color: TYPE_COLOR,
    fontStyle: "italic",
  },
});

let color_type_imports_like_other_type_stuff = DecorationsFromTree(
  ({ cursor, mutable_decorations }) => {
    if (cursor.name === "ImportDeclaration") {
      let type = cursor.node.getChild("type");
      if (type != null) {
        mutable_decorations.push(
          Decoration.mark({
            style: "opacity: 0.7",
            class: "type-stuff",
          }).range(cursor.from, cursor.to)
        );
        iterate_over_cursor({
          // @ts-ignore
          cursor: cursor,
          enter: (cursor) => {
            if (cursor.name === "VariableDefinition")
              mutable_decorations.push(
                Decoration.mark({
                  class: "type-name",
                  style: "color: black",
                }).range(cursor.from, cursor.to)
              );
          },
        });
        return false;
      }
    }
  }
);

const syntax_colors = syntaxHighlighting(
  HighlightStyle.define(
    [
      { tag: tags.special(tags.typeName), opacity: 0.7 },

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

      {
        tag: tags.typeName,
        class: "type",
      },

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
  )
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

export let javascript_syntax_highlighting = [
  Prec.lowest(candy_stick_colors),
  syntax_colors,
  syntax_classes,
  my_javascript_parser,
  lowercase_jsx_identifiers,
  color_type_imports_like_other_type_stuff,
];
