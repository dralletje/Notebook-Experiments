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
let L_BRACE_CODE = "{".charCodeAt(0);
let R_BRACE_CODE = "}".charCodeAt(0);

function space(ch: number) {
  return ch == 32 || ch == 9 || ch == 10 || ch == 13;
}

export const MarkdownInterpolation: MarkdownConfig = {
  defineNodes: [
    { name: "Interpolation", style: t.special(t.content) },
    { name: "InterpolationMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Interpolation",
      parse: (cx: InlineContext, next: number, pos: number) => {
        if (cx.char(pos) !== DOLLAR_CODE || cx.char(pos + 1) !== L_BRACE_CODE)
          return -1;

        let was_space = false;

        let elts = [cx.elt("InterpolationMark", pos, pos + 2)];
        for (let i = pos + 1; i < cx.end; i++) {
          let next = cx.char(i);
          if (next === R_BRACE_CODE) {
            if (was_space) return -1;
            return cx.addElement(
              cx.elt(
                "Interpolation",
                pos,
                i + 1,
                elts.concat(cx.elt("InterpolationMark", i, i + 1))
              )
            );
          }
          // if (next == 92 /* '\\' */) elts.push(cx.elt("Escape", i, i++ + 2));
          if (space(next)) {
            was_space = true;
          } else {
            was_space = false;
          }
        }
        return -1;
      },
    },
  ],
};

export const MarkdownKatex = [MarkdownInterpolation];
