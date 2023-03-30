import { EditorSelection, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";

import { markdown_html_preview } from "./parts/html-preview.jsx";
import { markdown_text_decorations } from "./parts/text-marks.js";
import { markdown_headers } from "./parts/headers.jsx";
import { markdown_show_hard_breaks } from "./parts/show-hard-breaks.js";
import { markdown_emoji_and_hr } from "./parts/emoji-and-hr.jsx";
import { markdown_lists_and_quotes } from "./parts/lists-and-quotes.jsx";
import { markdown_links } from "./parts/links.js";
import { markdown_html } from "./parts/html.js";
import { markdown_code_blocks } from "./parts/code-blocks.js";
import { markdown_tables } from "./parts/tables.js";
import { MarkdownKatexParser } from "./parts/katex/KatexParser";
import { markdown_katex } from "./parts/katex/katex";
import { MarkdownInlineHTML } from "./parts/inline-tag/InlineTagParser";
import { markdown_inline_tag } from "./parts/inline-tag/inline-tag";

// import { MarkdownInterpolation } from "./parts/interpolation/InterpolationParser";

export {
  markdown_html_preview,
  markdown_text_decorations,
  markdown_headers,
  markdown_show_hard_breaks,
  markdown_emoji_and_hr,
  markdown_lists_and_quotes,
  markdown_links,
  markdown_html,
  markdown_code_blocks,
  markdown_tables,
  MarkdownKatexParser,
  markdown_katex,
};

let markdown_styling_base_theme = EditorView.baseTheme({
  "& .cm-content": {
    "--accent-color": "rgb(200, 0, 0)",
    "accent-color": "var(--accent-color)",
    color: "white",
  },
  "& .cm-scroller": {
    overflow: "visible",
  },
});

let my_markdown_keymap = keymap.of([
  {
    key: "Shift-Enter",
    run: (view) => {
      let { from, to } = view.state.selection.main;
      let current_line = view.state.doc.lineAt(from);
      // @ts-ignore I'm pretty sure `current_line` exists here
      let indentation = current_line.text.match(/^\s*/)[0];
      view.dispatch({
        changes: { from: from, to: to, insert: `\n${indentation}` },
        selection: { anchor: from + 1 + indentation.length },
      });
      return true;
    },
  },
]);

export let basic_markdown_setup = [
  EditorState.tabSize.of(4),
  // indentUnit.of("    "),
  placeholder("The rest is still unwritten..."),
  markdown({
    addKeymap: false,
    base: markdownLanguage,
    extensions: [
      MarkdownKatexParser,
      MarkdownInlineHTML,
      // MarkdownInterpolation,
    ],
    // TODO Kind of part of markdown_code_blocks
    // defaultCodeLanguage: my_javascript_parser,
  }),
  keymap.of([
    {
      key: "Tab",
      run: indentMore,
      shift: indentLess,
    },
  ]),
  drawSelection(),
  EditorView.lineWrapping,

  // debug_syntax_plugin,

  // TODO Would love to have this, but needs more looking at to work with list items and task markers
  awesome_line_wrapping,
  EditorView.theme({
    ".awesome-wrapping-plugin-the-tabs": {
      "letter-spacing": "4px",
    },
  }),

  syntaxHighlighting(
    HighlightStyle.define([
      // { tag: tags.processingInstruction, color: "red" }
    ])
  ),

  markdown_styling_base_theme,
  my_markdown_keymap,

  markdown_html_preview,
  markdown_lists_and_quotes,
  markdown_show_hard_breaks,
  markdown_text_decorations,
  markdown_links,
  markdown_headers,
  markdown_emoji_and_hr,
  markdown_html,
  markdown_code_blocks,
  markdown_tables,

  markdown_katex,
  markdown_inline_tag,

  // Editor overal seems to work nicer if assoc = 1?
  // TODO This can't be a permanent solution, but it's a start
  EditorState.transactionFilter.of((tr) => {
    if (!tr.isUserEvent("select")) return tr;
    if (!tr.newSelection.main.empty) return tr;
    if (tr.newSelection.main.assoc === 1) return tr;

    let selection = tr.newSelection.main;
    let new_selection = EditorSelection.create([
      EditorSelection.cursor(
        selection.head,
        1,
        // @ts-ignore null vs undefined... Think Marijn just mixed them up
        selection.bidiLevel,
        selection.goalColumn
      ),
    ]);
    return [tr, { sequential: true, selection: new_selection }];
  }),

  keymap.of(defaultKeymap),
];
