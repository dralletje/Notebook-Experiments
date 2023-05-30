import {
  InlineContext,
  BlockContext,
  MarkdownConfig,
  LeafBlockParser,
  LeafBlock,
  Line,
  Element,
} from "@lezer/markdown";
import { tags as t } from "@lezer/highlight";

let DOLLAR_CODE = "$".charCodeAt(0);

class KatexParser implements LeafBlockParser {
  // Null means we haven't seen the second line yet, false means this
  // isn't a table, and an array means this is a table and we've
  // parsed the given rows so far.
  rows: false | null | Element[] = null;

  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock) {
    let dollar_pos = line.text.indexOf("$$");
    if (dollar_pos !== -1) {
      let to = leaf.start + leaf.content.length + 1 + dollar_pos + 2;
      cx.addLeafElement(
        leaf,
        cx.elt(
          "KatexBlock",
          leaf.start,
          leaf.start + leaf.content.length + 1 + dollar_pos + 2,
          []
        )
      );

      for (let element of cx.parser.parseInline(
        line.text.slice(dollar_pos + 2),
        to
      )) {
        cx.addLeafElement(leaf, element);
      }

      cx.nextLine();
      return true;
    } else {
      return false;
    }
  }

  finish(cx: BlockContext, leaf: LeafBlock) {
    // Empty line, but we need `$$` without any blank lines,
    // so no Katex for us!
    return false;
  }
}

function space(ch: number) {
  return ch == 32 || ch == 9 || ch == 10 || ch == 13;
}
function parseSubSuper(ch: number, node: string, mark: string) {
  return (cx: InlineContext, next: number, pos: number) => {
    if (next != ch || cx.char(pos + 1) == ch) return -1;
    let elts = [cx.elt(mark, pos, pos + 1)];
    for (let i = pos + 1; i < cx.end; i++) {
      let next = cx.char(i);
      if (next == ch)
        return cx.addElement(
          cx.elt(node, pos, i + 1, elts.concat(cx.elt(mark, i, i + 1)))
        );
      if (next == 92 /* '\\' */) elts.push(cx.elt("Escape", i, i++ + 2));
      if (space(next)) break;
    }
    return -1;
  };
}

/// This extension provides Katex
export const MarkdownKatexBlock: MarkdownConfig = {
  defineNodes: [
    { name: "KatexBlock", block: true, style: t.special(t.content) },
    // { name: "KatexMarker", style: t.processingInstruction },
  ],
  parseBlock: [
    {
      name: "Block",

      leaf(_, leaf) {
        if (leaf.content.startsWith("$$")) {
          return new KatexParser();
        }
        return null;
        // return hasPipe(leaf.content, 0) ? new KatexParser() : null;
      },
      // endLeaf(cx, line, leaf) {
      //   // if (leaf.parsers.some(p => p instanceof TableParser) || !hasPipe(line.text, line.basePos)) return false
      //   // let next = cx.scanLine(cx.absoluteLineEnd + 1).text
      //   // return delimiterLine.test(next) && parseRow(cx, line.text, line.basePos) == parseRow(cx, next, line.basePos)
      // },
    },
  ],
};

export const MarkdownKatexInline: MarkdownConfig = {
  defineNodes: [
    { name: "KatexInline", style: t.special(t.content) },
    { name: "KatexInlineMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "KatexInline",
      parse: parseSubSuper(DOLLAR_CODE, "KatexInline", "KatexInlineMark"),
    },
  ],
};

export const MarkdownKatexParser = [MarkdownKatexBlock, MarkdownKatexInline];
