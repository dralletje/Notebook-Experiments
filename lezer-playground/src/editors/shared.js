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

export let base_theme = EditorView.theme({
  ".cm-content": {
    "caret-color": "white",
    "padding-top": "8px",
    "padding-bottom": "8px",
    "padding-right": "16px",
    "min-height": "100%",
  },
  "&": {
    height: "100%",
    "font-family": "var(--mono-font-family)",
  },
});

let STUFF_FROM_PLUTO_I_GUESS = EditorView.baseTheme({
  ".cm-content, .cm-scroller, .cm-tooltip-autocomplete .cm-completionLabel": {
    "font-family": "inherit",
  },
  "&:focus-within .cm-matchingBracket": {
    color: "var(--cm-matchingBracket-color) !important",
    "font-weight": "700",
    "background-color": "var(--cm-matchingBracket-bg-color)",
    "border-radius": "2px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    height: "unset",
  },
  ".cm-selectionBackground": {
    background: "var(--cm-selection-background-blurred)",
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "var(--cm-selection-background)",
  },
  ".cm-editor": {
    color: "var(--cm-editor-text-color)",
  },
  ".cm-selectionMatch": {
    background: "none !important",
    "text-shadow": "0 0 8px rgba(0, 0, 0, 0.5)",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    "background-color": "unset",
    color: "unset",
  },
  ".cm-placeholder": {
    color: "var(--cm-placeholder-text-color)",
    "font-style": "italic",
  },
  ".cm-cursor": {
    "border-left-color": "#dcdcdc !important",
  },
});

export let base_extensions = [
  STUFF_FROM_PLUTO_I_GUESS,
  base_theme,

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
];
