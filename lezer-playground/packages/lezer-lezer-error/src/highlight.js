import { styleTags, tags as t } from "@lezer/highlight";

export const lezerErrorHighlight = styleTags({
  Name: t.propertyName,
  Dot: t.self,
  Top: t.moduleKeyword,
  Literal: t.literal,
  Rest: t.atom,
  AnonymousName: t.name,
  ErrorType: t.moduleKeyword,
});
