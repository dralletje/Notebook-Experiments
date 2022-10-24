// highlight.js
import { styleTags, tags as t } from "@lezer/highlight";

export const rustHighlighting = styleTags({
  "const macro_rules struct union enum type fn impl trait let static":
    t.definitionKeyword,
  "mod use crate": t.moduleKeyword,
  "pub unsafe async mut extern default move": t.modifier,
  "for if else loop while match continue break return await": t.controlKeyword,
  "as in ref": t.operatorKeyword,
  "where _ crate super dyn": t.keyword,
  self: t.self,
  String: t.string,
  Char: t.character,
  RawString: t.special(t.string),
  Boolean: t.bool,
  Identifier: t.variableName,
  "CallExpression/Identifier": t.function(t.variableName),
  BoundIdentifier: t.definition(t.variableName),
  "FunctionItem/BoundIdentifier": t.function(t.definition(t.variableName)),
  LoopLabel: t.labelName,
  FieldIdentifier: t.propertyName,
  "CallExpression/FieldExpression/FieldIdentifier": t.function(t.propertyName),
  Lifetime: t.special(t.variableName),
  ScopeIdentifier: t.namespace,
  TypeIdentifier: t.typeName,
  "MacroInvocation/Identifier MacroInvocation/ScopedIdentifier/Identifier":
    t.macroName,
  "MacroInvocation/TypeIdentifier MacroInvocation/ScopedIdentifier/TypeIdentifier":
    t.macroName,
  '"!"': t.macroName,
  UpdateOp: t.updateOperator,
  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  Integer: t.integer,
  Float: t.float,
  ArithOp: t.arithmeticOperator,
  LogicOp: t.logicOperator,
  BitOp: t.bitwiseOperator,
  CompareOp: t.compareOperator,
  "=": t.definitionOperator,
  ".. ... => ->": t.punctuation,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  ". DerefOp": t.derefOperator,
  "&": t.operator,
  ", ; ::": t.separator,
  "Attribute/...": t.meta,
});

// tokens.js
import { ExternalTokenizer } from "@lezer/lr";
import {
  Float,
  RawString,
  closureParamDelim,
  tpOpen,
  tpClose,
} from "./parser.terms";

const _b = 98,
  _e = 101,
  _f = 102,
  _r = 114,
  _E = 69,
  Zero = 48,
  Dot = 46,
  Plus = 43,
  Minus = 45,
  Hash = 35,
  Quote = 34,
  Pipe = 124,
  LessThan = 60,
  GreaterThan = 62;

function isNum(ch) {
  return ch >= 48 && ch <= 57;
}
function isNum_(ch) {
  return isNum(ch) || ch == 95;
}

export const literalTokens = new ExternalTokenizer((input, stack) => {
  if (isNum(input.next)) {
    let isFloat = false;
    do {
      input.advance();
    } while (isNum_(input.next));
    if (input.next == Dot) {
      isFloat = true;
      input.advance();
      if (isNum(input.next)) {
        do {
          input.advance();
        } while (isNum_(input.next));
      } else if (
        input.next == Dot ||
        input.next > 0x7f ||
        /\w/.test(String.fromCharCode(input.next))
      ) {
        return;
      }
    }
    if (input.next == _e || input.next == _E) {
      isFloat = true;
      input.advance();
      if (input.next == Plus || input.next == Minus) input.advance();
      if (!isNum_(input.next)) return;
      do {
        input.advance();
      } while (isNum_(input.next));
    }
    if (input.next == _f) {
      let after = input.peek(1);
      if (
        (after == Zero + 3 && input.peek(2) == Zero + 2) ||
        (after == Zero + 6 && input.peek(2) == Zero + 4)
      ) {
        input.advance(3);
        isFloat = true;
      } else {
        return;
      }
    }
    if (isFloat) input.acceptToken(Float);
  } else if (input.next == _b || input.next == _r) {
    if (input.next == _b) input.advance();
    if (input.next != _r) return;
    input.advance();
    let count = 0;
    while (input.next == Hash) {
      count++;
      input.advance();
    }
    if (input.next != Quote) return;
    input.advance();
    content: for (;;) {
      if (input.next < 0) return;
      let isQuote = input.next == Quote;
      input.advance();
      if (isQuote) {
        for (let i = 0; i < count; i++) {
          if (input.next != Hash) continue content;
          input.advance();
        }
        input.acceptToken(RawString);
        return;
      }
    }
  }
});

export const closureParam = new ExternalTokenizer((input) => {
  if (input.next == Pipe) input.acceptToken(closureParamDelim, 1);
});

export const tpDelim = new ExternalTokenizer((input) => {
  if (input.next == LessThan) input.acceptToken(tpOpen, 1);
  else if (input.next == GreaterThan) input.acceptToken(tpClose, 1);
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
