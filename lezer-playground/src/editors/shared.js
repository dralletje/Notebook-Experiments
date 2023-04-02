import {
  EditorView,
  drawSelection,
  keymap,
  placeholder,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { bracketMatching } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";

import { cool_cmd_d } from "../should-be-shared/commands";
import { dot_gutter } from "../should-be-shared/codemirror-dot-gutter";
import { ScrollIntoViewButOnlyTheEditor } from "../should-be-shared/ScrollIntoViewButOnlyTheEditor";

export let base_extensions = [
  EditorView.scrollMargins.of(() => ({ top: 32, bottom: 32 })),
  dot_gutter,
  EditorState.tabSize.of(2),
  placeholder("The rest is still unwritten..."),
  bracketMatching({}),
  closeBrackets(),
  highlightSelectionMatches(),
  drawSelection({ cursorBlinkRate: 0 }),

  search({
    caseSensitive: true,
    top: true,
  }),
  keymap.of(searchKeymap),
  keymap.of([indentWithTab]),
  cool_cmd_d,
  keymap.of(defaultKeymap),

  ScrollIntoViewButOnlyTheEditor,
  EditorView.theme({
    ".cm-content": {
      "caret-color": "white",
    },
  }),
];
