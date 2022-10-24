// Highlight.js
import { styleTags, tags as t } from "@lezer/highlight";

export const jsHighlight = styleTags({
  "get set async static": t.modifier,
  "for while do if else switch try catch finally return throw break continue default case":
    t.controlKeyword,
  "in of await yield void typeof delete instanceof": t.operatorKeyword,
  "let var const function class extends": t.definitionKeyword,
  "import export from": t.moduleKeyword,
  "with debugger as new": t.keyword,
  TemplateString: t.special(t.string),
  super: t.atom,
  BooleanLiteral: t.bool,
  this: t.self,
  null: t.null,
  Star: t.modifier,
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
  PropertyDefinition: t.definition(t.propertyName),
  PrivatePropertyDefinition: t.definition(t.special(t.propertyName)),
  UpdateOp: t.updateOperator,
  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  Number: t.number,
  String: t.string,
  ArithOp: t.arithmeticOperator,
  LogicOp: t.logicOperator,
  BitOp: t.bitwiseOperator,
  CompareOp: t.compareOperator,
  RegExp: t.regexp,
  Equals: t.definitionOperator,
  Arrow: t.function(t.punctuation),
  ": Spread": t.punctuation,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  "InterpolationStart InterpolationEnd": t.special(t.brace),
  ".": t.derefOperator,
  ", ;": t.separator,

  TypeName: t.typeName,
  TypeDefinition: t.definition(t.typeName),
  "type enum interface implements namespace module declare":
    t.definitionKeyword,
  "abstract global Privacy readonly override": t.modifier,
  "is keyof unique infer": t.operatorKeyword,

  JSXAttributeValue: t.attributeValue,
  JSXText: t.content,
  "JSXStartTag JSXStartCloseTag JSXSelfCloseEndTag JSXEndTag": t.angleBracket,
  "JSXIdentifier JSXNameSpacedName": t.tagName,
  "JSXAttribute/JSXIdentifier JSXAttribute/JSXNameSpacedName": t.attributeName,
  "JSXBuiltin/JSXIdentifier": t.standard(t.tagName),
});

// Tokens.js

/* Hand-written tokenizers for JavaScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

import { ExternalTokenizer, ContextTracker } from "@lezer/lr";
import {
  insertSemi,
  noSemi,
  incdec,
  incdecPrefix,
  templateContent,
  InterpolationStart,
  templateEnd,
  spaces,
  newline,
  BlockComment,
  LineComment,
  TSExtends,
  Dialect_ts,
} from "./parser.terms.js";

const space = [
  9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
  8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288,
];

const braceR = 125,
  braceL = 123,
  semicolon = 59,
  slash = 47,
  star = 42,
  plus = 43,
  minus = 45,
  dollar = 36,
  backtick = 96,
  backslash = 92;

export const trackNewline = new ContextTracker({
  start: false,
  shift(context, term) {
    return term == LineComment || term == BlockComment || term == spaces
      ? context
      : term == newline;
  },
  strict: false,
});

export const insertSemicolon = new ExternalTokenizer(
  (input, stack) => {
    let { next } = input;
    if (
      (next == braceR || next == -1 || stack.context) &&
      stack.canShift(insertSemi)
    )
      input.acceptToken(insertSemi);
  },
  { contextual: true, fallback: true }
);

export const noSemicolon = new ExternalTokenizer(
  (input, stack) => {
    let { next } = input,
      after;
    if (space.indexOf(next) > -1) return;
    if (next == slash && ((after = input.peek(1)) == slash || after == star))
      return;
    if (
      next != braceR &&
      next != semicolon &&
      next != -1 &&
      !stack.context &&
      stack.canShift(noSemi)
    )
      input.acceptToken(noSemi);
  },
  { contextual: true }
);

export const incdecToken = new ExternalTokenizer(
  (input, stack) => {
    let { next } = input;
    if (next == plus || next == minus) {
      input.advance();
      if (next == input.next) {
        input.advance();
        let mayPostfix = !stack.context && stack.canShift(incdec);
        input.acceptToken(mayPostfix ? incdec : incdecPrefix);
      }
    }
  },
  { contextual: true }
);

export const template = new ExternalTokenizer((input) => {
  for (let afterDollar = false, i = 0; ; i++) {
    let { next } = input;
    if (next < 0) {
      if (i) input.acceptToken(templateContent);
      break;
    } else if (next == backtick) {
      if (i) input.acceptToken(templateContent);
      else input.acceptToken(templateEnd, 1);
      break;
    } else if (next == braceL && afterDollar) {
      if (i == 1) input.acceptToken(InterpolationStart, 1);
      else input.acceptToken(templateContent, -1);
      break;
    } else if (next == 10 /* "\n" */ && i) {
      // Break up template strings on lines, to avoid huge tokens
      input.advance();
      input.acceptToken(templateContent);
      break;
    } else if (next == backslash) {
      input.advance();
    }
    afterDollar = next == dollar;
    input.advance();
  }
});

export const tsExtends = new ExternalTokenizer((input, stack) => {
  if (input.next != 101 || !stack.dialectEnabled(Dialect_ts)) return;
  input.advance();
  for (let i = 0; i < 6; i++) {
    if (input.next != "xtends".charCodeAt(i)) return;
    input.advance();
  }
  if (
    (input.next >= 57 && input.next <= 65) ||
    (input.next >= 48 && input.next <= 90) ||
    input.next == 95 ||
    (input.next >= 97 && input.next <= 122) ||
    input.next > 160
  )
    return;
  input.acceptToken(TSExtends);
});

// A very dim/dull syntax highlighting so you have something to look at, but also to trigger you to write your own ;)
// Also shows that you can use `export let extension = [...]`, to add extensions to the "demo text" editor.
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
