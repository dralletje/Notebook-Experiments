import { styleTags, tags as t } from "@lezer/highlight";

export const customJsHighlight = styleTags({
  Equals: t.definitionOperator,
  "JSXAttribute/Equals": t.punctuation,

  // TODO Make this... a little bit more beautiful than just BAM HERE TYPE
  "TypeAliasDeclaration/...": t.typeName,

  // TODO So this one is odd:
  // .... lezer/javascript currently thinks that for `class X extends Y`, `Y` is a `TypeName`
  // .... but it should be a `VariableName`!! It can't even be a type ever... I think?
  "ClassDeclaration/TypeName": t.className,

  "!": t.special(t.logicOperator),
});
