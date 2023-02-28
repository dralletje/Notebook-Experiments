import { styleTags, tags as t } from "@lezer/highlight";

export let inspectorHighlight = styleTags({
  Name: t.variableName,
  String: t.string,
  Error: t.invalid,
  PropName: t.propertyName,
  "Props/...": t.meta,
});
