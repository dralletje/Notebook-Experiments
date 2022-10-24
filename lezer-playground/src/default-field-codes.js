export let DEFAULT_TO_PARSE = `
{
  "string": "@dral/lezer-playground",
  "number": 100,
  "boolean": true,
  "null": null,
  "object": {
    "property": "^6.1.0",
    "also-property": 800
  },
  "array": [4, 8, 9, 200, 23]
}
`.trim();

export let DEFAULT_PARSER_CODE = `
@top JsonText { value }

value { True | False | Null | Number | String | Object | Array }

String { string }
Object { "{" list<Property>? "}" }
Array  { "[" list<value>? "]" }

Property { PropertyName ":" value }
PropertyName { string }


@tokens {
  True  { "true" }
  False { "false" }
  Null  { "null" }

  Number { '-'? int frac? exp?  }
  int  { '0' | $[1-9] @digit* }
  frac { '.' @digit+ }
  exp  { $[eE] $[+\\-]? @digit+ }

  string { '"' char* '"' }
  char { $[\\u{20}\\u{21}\\u{23}-\\u{5b}\\u{5d}-\\u{10ffff}] | "\\\\" esc }
  esc  { $["\\\\\\/bfnrt] | "u" hex hex hex hex }
  hex  { $[0-9a-fA-F] }

  whitespace { $[ \\n\\r\\t] }

  "{" "}" "[" "]"
}

@skip { whitespace }
list<item> { item ("," item)* }

@external propSource jsonHighlighting from "./highlight"

@detectDelim
`.trim();

export let DEFAULT_JAVASCRIPT_STUFF = `
import { styleTags, tags as t } from "@lezer/highlight";

export const jsonHighlighting = styleTags({
  String: t.string,
  Number: t.number,
  "True False": t.bool,
  PropertyName: t.propertyName,
  Null: t.null,
  ",": t.separator,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
});

// A very dim/dull syntax highlighting so you have something to look at, but also to trigger you to write your own ;)
// Also shows that you can use \`export let extension = [...]\`, to add extensions to the "demo text" editor.
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
const syntax_colors = syntaxHighlighting(
  HighlightStyle.define(
    [
      { tag: t.name, color: "#a8a8a8" },
      { tag: t.propertyName, color: "#966a6a" },
      { tag: t.comment, color: "#4b4949" },
      { tag: t.atom, color: "#a25496" },

      { tag: t.literal, color: "#7b87b8" },
      { tag: t.unit, color: "#7b87b8" },
      { tag: t.null, color: "#7b87b8" },

      { tag: t.keyword, color: "#585858" },
      { tag: t.punctuation, color: "#585858" },
      { tag: t.derefOperator, color: "#585858" },
      { tag: t.special(t.brace), fontWeight: 700 },

      { tag: t.operator, color: "white" },
      { tag: t.self, color: "white" },
      { tag: t.function(t.punctuation), color: "white" },
      { tag: t.special(t.logicOperator), color: "white", fontWeight: "bold" },
      { tag: t.moduleKeyword, color: "white", fontWeight: "bold" },
      { tag: t.controlKeyword, color: "white", fontWeight: "bold" },
      { tag: t.controlOperator, color: "white", fontWeight: "bold" },
    ],
    { all: { color: "#585858" } }
  )
);

export let extensions = [syntax_colors];
`.trim();
