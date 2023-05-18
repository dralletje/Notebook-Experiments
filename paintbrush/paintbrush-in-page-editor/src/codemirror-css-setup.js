import { EditorState, Prec } from "@codemirror/state";
import {
  keymap,
  EditorView,
  highlightSpecialChars,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import {
  indentOnInput,
  indentUnit,
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches } from "@codemirror/search";
import { css, cssLanguage } from "@codemirror/lang-css";
import {
  closeBrackets,
  autocompletion,
  acceptCompletion,
} from "@codemirror/autocomplete";

let syntax_classes = EditorView.theme({
  // Default font color:
  ".cm-content": {
    color: "#655d8d",
  },

  // Repeated so specificity is increased...
  // I need this to show the colors in the selected autocomplete...
  // TODO Ideally I'd just do a custom render or something on the autocomplete
  ".boring.boring.boring": {
    color: "#655d8d",
  },
  ".very-important.very-important.very-important": {
    color: "#f3f1f1",
    fontWeight: 700,
  },
  ".important.important.important": {
    color: "#f3f1f1",
  },
  ".property.property.property": {
    color: "#cb00d7",
  },
  ".variable.variable.variable": {
    color: "#a16fff",
  },
  ".literal.literal.literal": {
    color: "#00a7ca",
  },
  ".comment.comment.comment": {
    color: "#747474",
    fontStyle: "italic",
  },
});

const css_colors = HighlightStyle.define(
  [
    {
      tag: tags.propertyName,
      class: "property",
    },
    {
      tag: tags.variableName,
      class: "variable",
    },
    { tag: tags.modifier, class: "important" },
    { tag: tags.operatorKeyword, class: "important" },
    { tag: tags.punctuation, class: "boring" },
    { tag: tags.literal, class: "literal" },
    { tag: tags.unit, class: "literal" },
    { tag: tags.atom, class: "literal" },

    { tag: tags.tagName, class: "very-important" },
    {
      tag: tags.className,
      color: "red",
    },
    {
      tag: tags.constant(tags.className),
      class: "very-important",
    },
    {
      tag: tags.comment,
      class: "comment",
    },
  ],
  {
    scope: cssLanguage,
  }
);

export let basic_css_extensions = [
  syntax_classes,

  EditorState.tabSize.of(2),
  indentUnit.of("\t"),
  highlightSpecialChars(),
  drawSelection(),
  EditorView.lineWrapping,

  EditorState.allowMultipleSelections.of(true),
  // Multiple cursors with `alt` instead of the default `ctrl` (like vscode)
  EditorView.clickAddsSelectionRange.of(
    (event) => event.altKey && !event.shiftKey
  ),

  EditorView.theme({}, { dark: true }),
  // history(),
  indentOnInput(),
  closeBrackets(),
  bracketMatching(),

  EditorView.theme({
    ".cm-tooltip.cm-tooltip-autocomplete": {
      "background-color": "#000000",
      "border-radius": "9px",
      transform: "translateY(10px) translateX(-7px)",
      overflow: "hidden",

      "& > ul": {
        font: "inherit",
        "max-width": "min(400px, 95vw)",

        "& > li": {
          "padding-inline": "8px",
          display: "flex",

          "&:first-child": {
            "padding-top": "4px",
          },
          "&:last-child": {
            "padding-bottom": "4px",
          },
          "&[aria-selected]": {
            background: "#ffffff2b",
            // filter: "brightness(1.5)",
          },

          "& .cm-completionMatchedText": {
            "text-decoration": "none",
            "font-weight": "bold",
          },
          "& .cm-completionDetail": {
            opacity: 0.7,
            flex: 1,
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginLeft: "2.5em",
          },
        },
      },
    },
  }),
  autocompletion({
    icons: false,
    optionClass: (x) => x.type ?? "",
  }),
  Prec.highest(
    keymap.of([
      {
        key: "Tab",
        run: acceptCompletion,
      },
    ])
  ),

  keymap.of([...defaultKeymap]),

  css(),
  syntaxHighlighting(css_colors),
];
