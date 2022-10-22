import { lezerLanguage } from "@codemirror/lang-lezer";
import { EditorView } from "@codemirror/view";
import {
  HighlightStyle,
  LanguageSupport,
  syntaxHighlighting,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

let lezerStyleTags = styleTags({
  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  AnyChar: t.character,
  Literal: t.string,
  "tokens from grammar as empty prop extend specialize": t.keyword,
  "@top @left @right @cut @external": t.modifier,
  "@precedence @tokens @context @dialects @skip @detectDelim @conflict":
    t.definitionKeyword,
  "@extend @specialize": t.operatorKeyword,
  "CharSet InvertedCharSet": t.regexp,
  CharClass: t.atom,
  RuleName: t.variableName,
  "RuleDeclaration/RuleName InlineRule/RuleName TokensBody/RuleName":
    t.definition(t.variableName),
  PrecedenceName: t.labelName,
  Name: t.name,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  '"!" ~ "*" + ? |': t.operator,
  "=": t.punctuation,

  "Call/RuleName": t.function(t.variableName),
  "PrecedenceMarker!": t.className,
  "Prop/AtName": t.propertyName,
  propSource: t.keyword,
});

let lezer_syntax_classes = EditorView.theme({
  ".boring": {
    color: "#947eff",
  },
  ".very-important": {
    color: "#b6b6b6",
    fontWeight: 700,
  },
  ".important": {
    color: "#947eff",
  },
  ".property": {
    color: "#cb00d7",
  },
  ".variable": {
    color: "#7229ff",
  },
  ".literal": {
    color: "#00a7ca",
  },
  ".comment": {
    color: "#747474",
    fontStyle: "italic",
  },
});

export let lezer_extension = new LanguageSupport(
  lezerLanguage.configure({
    props: [lezerStyleTags],
  })
);
export let lezer_highlight = syntaxHighlighting(
  HighlightStyle.define(
    [
      { tag: t.lineComment, class: "comment" },
      { tag: t.blockComment, class: "comment" },
      { tag: t.character, class: "literal" },
      { tag: t.string, class: "literal" },
      { tag: t.keyword, class: "important" },
      { tag: t.modifier, class: "green" },
      { tag: t.definitionKeyword, class: "very-important" },
      { tag: t.operatorKeyword, class: "important" },
      { tag: t.regexp, class: "literal" },
      { tag: t.atom, class: "literal" },
      { tag: t.variableName, class: "variable" },
      { tag: t.definition(t.variableName), class: "variable" },
      { tag: t.name, class: "variable" },
      { tag: t.paren, class: "very-important" },
      { tag: t.squareBracket, class: "boring" },
      { tag: t.brace, class: "boring" },
      { tag: t.operator, class: "very-important" },

      { tag: t.labelName, class: "property" },
      { tag: t.function(t.variableName), class: "variable" },

      { tag: t.propertyName, class: "property" },
      { tag: t.className, class: "property" },
      { tag: t.modifier, class: "very-important" },
      { tag: t.punctuation, class: "boring" },
    ],
    {
      all: "boring",
    }
  )
);

export let lezer_syntax_extensions = [
  lezer_extension,
  lezer_highlight,
  lezer_syntax_classes,
];
