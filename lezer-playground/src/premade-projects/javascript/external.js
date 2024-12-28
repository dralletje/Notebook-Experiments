////////////////////////////////////////////
// highlight.js
////////////////////////////////////////////
import { styleTags, tags as t } from "@lezer/highlight";

import {styleTags, tags as t} from "@lezer/highlight"

export const jsHighlight = styleTags({
  "get set async static": t.modifier,
  "for while do if else switch try catch finally return throw break continue default case": t.controlKeyword,
  "in of await yield void typeof delete instanceof": t.operatorKeyword,
  "let var const using function class extends": t.definitionKeyword,
  "import export from": t.moduleKeyword,
  "with debugger as new": t.keyword,
  TemplateString: t.special(t.string),
  super: t.atom,
  BooleanLiteral: t.bool,
  this: t.self,
  null: t.null,
  Star: t.modifier,
  VariableName: t.variableName,
  "CallExpression/VariableName TaggedTemplateExpression/VariableName": t.function(t.variableName),
  VariableDefinition: t.definition(t.variableName),
  Label: t.labelName,
  PropertyName: t.propertyName,
  PrivatePropertyName: t.special(t.propertyName),
  "CallExpression/MemberExpression/PropertyName": t.function(t.propertyName),
  "FunctionDeclaration/VariableDefinition": t.function(t.definition(t.variableName)),
  "ClassDeclaration/VariableDefinition": t.definition(t.className),
  "NewExpression/VariableName": t.className,
  PropertyDefinition: t.definition(t.propertyName),
  PrivatePropertyDefinition: t.definition(t.special(t.propertyName)),
  UpdateOp: t.updateOperator,
  "LineComment Hashbang": t.lineComment,
  BlockComment: t.blockComment,
  Number: t.number,
  String: t.string,
  Escape: t.escape,
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
  "@": t.meta,

  TypeName: t.typeName,
  TypeDefinition: t.definition(t.typeName),
  "type enum interface implements namespace module declare": t.definitionKeyword,
  "abstract global Privacy readonly override": t.modifier,
  "is keyof unique infer asserts": t.operatorKeyword,

  JSXAttributeValue: t.attributeValue,
  JSXText: t.content,
  "JSXStartTag JSXStartCloseTag JSXSelfCloseEndTag JSXEndTag": t.angleBracket,
  "JSXIdentifier JSXNameSpacedName": t.tagName,
  "JSXAttribute/JSXIdentifier JSXAttribute/JSXNameSpacedName": t.attributeName,
  "JSXBuiltin/JSXIdentifier": t.standard(t.tagName)
})

////////////////////////////////////////////
// tokens.js
////////////////////////////////////////////

/* Hand-written tokenizers for JavaScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {insertSemi, noSemi, noSemiType, incdec, incdecPrefix, questionDot,
        spaces, newline, BlockComment, LineComment,
        JSXStartTag, Dialect_jsx} from "./parser.terms.js"

const space = [9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200,
              8201, 8202, 8232, 8233, 8239, 8287, 12288]

const braceR = 125, semicolon = 59, slash = 47, star = 42, plus = 43, minus = 45, lt = 60, comma = 44,
      question = 63, dot = 46, bracketL = 91

export const trackNewline = new ContextTracker({
  start: false,
  shift(context, term) {
    return term == LineComment || term == BlockComment || term == spaces ? context : term == newline
  },
  strict: false
})

export const insertSemicolon = new ExternalTokenizer((input, stack) => {
  let {next} = input
  if (next == braceR || next == -1 || stack.context)
    input.acceptToken(insertSemi)
}, {contextual: true, fallback: true})

export const noSemicolon = new ExternalTokenizer((input, stack) => {
  let {next} = input, after
  if (space.indexOf(next) > -1) return
  if (next == slash && ((after = input.peek(1)) == slash || after == star)) return
  if (next != braceR && next != semicolon && next != -1 && !stack.context)
    input.acceptToken(noSemi)
}, {contextual: true})

export const noSemicolonType = new ExternalTokenizer((input, stack) => {
  if (input.next == bracketL && !stack.context) input.acceptToken(noSemiType)
}, {contextual: true})

export const operatorToken = new ExternalTokenizer((input, stack) => {
  let {next} = input
  if (next == plus || next == minus) {
    input.advance()
    if (next == input.next) {
      input.advance()
      let mayPostfix = !stack.context && stack.canShift(incdec)
      input.acceptToken(mayPostfix ? incdec : incdecPrefix)
    }
  } else if (next == question && input.peek(1) == dot) {
    input.advance(); input.advance()
    if (input.next < 48 || input.next > 57) // No digit after
      input.acceptToken(questionDot)
  }
}, {contextual: true})

function identifierChar(ch, start) {
  return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch == 95 || ch >= 192 ||
    !start && ch >= 48 && ch <= 57
}

export const jsx = new ExternalTokenizer((input, stack) => {
  if (input.next != lt || !stack.dialectEnabled(Dialect_jsx)) return
  input.advance()
  if (input.next == slash) return
  // Scan for an identifier followed by a comma or 'extends', don't
  // treat this as a start tag if present.
  let back = 0
  while (space.indexOf(input.next) > -1) { input.advance(); back++ }
  if (identifierChar(input.next, true)) {
    input.advance()
    back++
    while (identifierChar(input.next, false)) { input.advance(); back++ }
    while (space.indexOf(input.next) > -1) { input.advance(); back++ }
    if (input.next == comma) return
    for (let i = 0;; i++) {
      if (i == 7) {
        if (!identifierChar(input.next, true)) return
        break
      }
      if (input.next != "extends".charCodeAt(i)) break
      input.advance()
      back++
    }
  }
  input.acceptToken(JSXStartTag, -back)
})

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
