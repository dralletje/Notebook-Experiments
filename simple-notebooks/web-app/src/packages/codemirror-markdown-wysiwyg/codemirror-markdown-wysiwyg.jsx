import { EditorState } from "@codemirror/state";
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

import { markdown_html_preview } from "./parts/html-preview.jsx";
import { markdown_text_decorations } from "./parts/text-marks.js";
import { markdown_headers } from "./parts/headers.jsx";
import { markdown_show_hard_breaks } from "./parts/show-hard-breaks.js";
import { markdown_emoji_and_hr } from "./parts/emoji-and-hr.jsx";
import { markdown_blocks_extension } from "./parts/blocks.jsx";
import { markdown_links } from "./parts/links.js";
import { markdown_html } from "./parts/html.js";
import { markdown_code_blocks } from "./parts/code-blocks.js";
import { markdown_tables } from "./parts/tables.js";

let markdown_styling_base_theme = EditorView.baseTheme({
  "& .cm-content": {
    "--accent-color": "var(--accent-color, rgba(200, 0, 0))",
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
  indentUnit.of("\t"),
  placeholder("The rest is still unwritten..."),
  markdown({
    addKeymap: false,
    base: markdownLanguage,
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
  keymap.of(defaultKeymap),
  drawSelection(),
  // TODO Would love to have this, but needs more looking at to work with list items and task markers
  // awesome_line_wrapping,
  EditorView.lineWrapping,

  markdown_styling_base_theme,
  my_markdown_keymap,

  markdown_html_preview,
  markdown_blocks_extension,
  markdown_show_hard_breaks,
  markdown_text_decorations,
  markdown_links,
  markdown_headers,
  markdown_emoji_and_hr,
  markdown_html,
  markdown_code_blocks,
  markdown_tables,
];
