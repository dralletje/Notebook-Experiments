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

let LT_CODE = "<".charCodeAt(0);
let GT_CODE = ">".charCodeAt(0);
let SLASH_CODE = "/".charCodeAt(0);

// let START_TAG = "<kbd>";
// let END_TAG = "</kbd>";

function space(ch: number) {
  return ch == 32 || ch == 9 || ch == 10 || ch == 13;
}

let parse = (cx: InlineContext, next: number, pos: number) => {
  if (next !== LT_CODE) return -1;
  if (cx.char(pos + 1) === SLASH_CODE) return -1;

  let tag = "";
  for (let i = pos + 1; i < cx.end; i++) {
    let next = cx.char(i);
    if (space(next)) return -1;
    if (next === GT_CODE) {
      tag = cx.slice(pos + 1, i);
      break;
    }
  }
  if (tag === "") return -1;

  let content_start = pos + 1 + tag.length + 1;
  let end_tag = `</${tag}>`;

  let elts = [cx.elt("InlineTagMark", pos, pos + 1 + tag.length + 1)];
  for (let i = pos + 1; i < cx.end; i++) {
    let next = cx.char(i);
    if (next === LT_CODE) {
      let UHHH = cx.slice(i, i + end_tag.length);
      if (cx.slice(i, i + end_tag.length) !== end_tag) {
        // TODO Might be a nested tag, but we don't do these yet
        continue;
      }

      return cx.addElement(
        cx.elt("InlineTag", pos, i + end_tag.length, [
          ...elts,
          ...cx.parser.parseInline(cx.slice(content_start, i), content_start),
          cx.elt("InlineTagMark", i, i + end_tag.length),
        ])
      );
    }
  }

  return -1;
  // return cx.addElement(
  //   cx.elt("InlineTag", pos, cx.end, [
  //     ...elts,
  //     ...cx.parser.parseInline(cx.slice(content_start, cx.end), content_start),
  //   ])
  // );
};

export const MarkdownInlineHTML: MarkdownConfig = {
  defineNodes: [
    { name: "InlineTag", style: t.special(t.content) },
    { name: "InlineTagMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      before: "HTMLTag",
      name: "InlineTag",
      parse: parse,
    },
  ],
};
