// highlight.js
import { styleTags, tags as t } from "@lezer/highlight";

export const cppHighlighting = styleTags({
  "typedef struct union enum class typename decltype auto template operator friend noexcept namespace using __attribute__ __declspec __based":
    t.definitionKeyword,
  "extern MsCallModifier MsPointerModifier extern static register inline const volatile restrict _Atomic mutable constexpr virtual explicit VirtualSpecifier Access":
    t.modifier,
  "if else switch for while do case default return break continue goto throw try catch":
    t.controlKeyword,
  "new sizeof delete static_assert": t.operatorKeyword,
  "NULL nullptr": t.null,
  this: t.self,
  "True False": t.bool,
  "TypeSize PrimitiveType": t.standard(t.typeName),
  TypeIdentifier: t.typeName,
  FieldIdentifier: t.propertyName,
  "CallExpression/FieldExpression/FieldIdentifier": t.function(t.propertyName),
  StatementIdentifier: t.labelName,
  "Identifier DestructorName": t.variableName,
  "CallExpression/Identifier": t.function(t.variableName),
  "CallExpression/ScopedIdentifier/Identifier": t.function(t.variableName),
  "FunctionDeclarator/Identifier FunctionDeclarator/DestructorName": t.function(
    t.definition(t.variableName)
  ),
  NamespaceIdentifier: t.namespace,
  OperatorName: t.operator,
  ArithOp: t.arithmeticOperator,
  LogicOp: t.logicOperator,
  BitOp: t.bitwiseOperator,
  CompareOp: t.compareOperator,
  AssignOp: t.definitionOperator,
  UpdateOp: t.updateOperator,
  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  Number: t.number,
  String: t.string,
  "RawString SystemLibString": t.special(t.string),
  CharLiteral: t.character,
  EscapeSequence: t.escape,
  PreProcArg: t.meta,
  "PreprocDirectiveName #include #ifdef #ifndef #if #define #else #endif #elif":
    t.processingInstruction,
  MacroName: t.special(t.name),
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  "< >": t.angleBracket,
  ". ->": t.derefOperator,
  ", ;": t.separator,
});

// tokens.js
import { ExternalTokenizer } from "@lezer/lr";
import {
  RawString,
  templateArgsEndFallback,
  MacroName,
} from "./parser.terms.js";

const R = 82,
  L = 76,
  u = 117,
  U = 85,
  a = 97,
  z = 122,
  A = 65,
  Z = 90,
  Underscore = 95,
  Zero = 48,
  Quote = 34,
  ParenL = 40,
  ParenR = 41,
  Space = 32,
  Newline = 10,
  GreaterThan = 62;

export const rawString = new ExternalTokenizer((input) => {
  // Raw string literals can start with: R, LR, uR, UR, u8R
  if (input.next == L || input.next == U) {
    input.advance();
  } else if (input.next == u) {
    input.advance();
    if (input.next == Zero + 8) input.advance();
  }
  if (input.next != R) return;
  input.advance();
  if (input.next != Quote) return;
  input.advance();

  let marker = "";
  while (input.next != ParenL) {
    if (input.next == Space || input.next <= 13 || input.next == ParenR) return;
    marker += String.fromCharCode(input.next);
    input.advance();
  }
  input.advance();

  for (;;) {
    if (input.next < 0) return input.acceptToken(RawString);
    if (input.next == ParenR) {
      let match = true;
      for (let i = 0; match && i < marker.length; i++)
        if (input.peek(i + 1) != marker.charCodeAt(i)) match = false;
      if (match && input.peek(marker.length + 1) == Quote)
        return input.acceptToken(RawString, 2 + marker.length);
    }
    input.advance();
  }
});

export const fallback = new ExternalTokenizer(
  (input) => {
    if (input.next == GreaterThan) {
      // Provide a template-args-closing token when the next characters
      // are ">>", in which case the regular tokenizer will only see a
      // bit shift op.
      if (input.peek(1) == GreaterThan)
        input.acceptToken(templateArgsEndFallback, 1);
    } else {
      // Notice all-uppercase identifiers
      let sawLetter = false,
        i = 0;
      for (; ; i++) {
        if (input.next >= A && input.next <= Z) sawLetter = true;
        else if (input.next >= a && input.next <= z) return;
        else if (
          input.next != Underscore &&
          !(input.next >= Zero && input.next <= Zero + 9)
        )
          break;
        input.advance();
      }
      if (sawLetter && i > 1) input.acceptToken(MacroName);
    }
  },
  { extend: true }
);

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
