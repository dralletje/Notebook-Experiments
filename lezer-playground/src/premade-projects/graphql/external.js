import { styleTags, tags as t } from "@lezer/highlight";

export const highlighting = styleTags({
  StringValue: t.string,
  FloatValue: t.float,
  IntValue: t.integer,
  NullValue: t.null,
  BooleanValue: t.bool,
  "EnumValue!": t.tagName,

  "[ ]": t.squareBracket,
  "{ }": t.brace,
  "( )": t.paren,

  Name: t.name,
  "Variable!": t.variableName,
  "NamedType!": t.typeName,
  "ObjectField/Name": t.propertyName,
  "Argument/Name": t.special(t.propertyName),
  "Field/Name": t.propertyName,
  "FieldDefinition/Name": t.propertyName,
  "@ Directive/Name": t.macroName,
  "TypeExtension/*/Name": t.definition(t.typeName),
  "TypeDefinition/*/Name": t.definition(t.typeName),
  "InterfaceTypeExtension/Name": t.definition(t.typeName),

  "FragmentName/Name": t.function(t.typeName),
  "OperationDefinition/Name": t.special(t.variableName),

  '"!"': t.keyword,
  "Directive/...": t.function(t.macroName),
  "Field/Arguments": t.function(t.propertyName),

  extend_keyword: t.keyword,
  "query mutation subscription": t.keyword,
  "type schema scalar interface union enum input": t.definitionKeyword,
  fragment: t.definitionKeyword,
  // TODO extend
  "extend implements &": t.definitionKeyword,
  on: t.keyword,

  LineComment: t.lineComment,
  "Description!": t.docComment,
});

// A very dim/dull syntax highlighting so you have something to look at, but also to trigger you to write your own ;)
// Also shows that you can use `export let extension = [...]`, to add extensions to the "demo text" editor.
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
const syntax_colors = syntaxHighlighting(
  HighlightStyle.define(
    [
      { tag: t.variableName, color: "#576dff" },
      { tag: t.special(t.variableName), color: "#cfcfcf" },
      { tag: t.keyword, color: "#929292" },
      { tag: t.typeName, color: "#6e5252" },
      { tag: t.macroName, color: "#346776" },
      { tag: t.propertyName, color: "#6992a0" },

      { tag: t.literal, color: "#7b87b8" },
      { tag: t.null, color: "#7b87b8" },
      { tag: t.tagName, color: "#7b87b8" },
    ],
    { all: { color: "#585858" } }
  )
);

export let extensions = [syntax_colors];
