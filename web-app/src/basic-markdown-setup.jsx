import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { EditorState } from "@codemirror/state";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { ReactWidget } from "react-codemirror-widget";
import React from "react";

export const syntax_colors = HighlightStyle.define(
  [
    { tag: tags.propertyName, color: "var(--cm-property-color)" },
    { tag: tags.unit, color: "var(--cm-tag-color)" },
    { tag: tags.literal, color: "var(--cm-builtin-color)", fontWeight: 700 },
    { tag: tags.macroName, color: "var(--cm-macro-color)", fontWeight: 700 },
    {
      tag: tags.standard(tags.variableName),
      color: "var(--cm-builtin-color)",
      fontWeight: 700,
    },

    { tag: tags.bool, color: "var(--cm-builtin-color)", fontWeight: 700 },

    { tag: tags.keyword, color: "var(--cm-keyword-color)" },
    {
      tag: tags.comment,
      color: "var(--cm-comment-color)",
      fontStyle: "italic",
    },
    { tag: tags.atom, color: "var(--cm-atom-color)" },
    { tag: tags.number, color: "var(--cm-number-color)" },
    // { tag: tags.property, color: "#48b685" },
    // { tag: tags.attribute, color: "#48b685" },
    { tag: tags.keyword, color: "var(--cm-keyword-color)" },
    { tag: tags.string, color: "var(--cm-string-color)" },
    { tag: tags.variableName, color: "var(--cm-var-color)", fontWeight: 700 },
    // { tag: tags.variable2, color: "#06b6ef" },
    { tag: tags.typeName, color: "var(--cm-type-color)", fontStyle: "italic" },
    {
      tag: tags.typeOperator,
      color: "var(--cm-type-color)",
      fontStyle: "italic",
    },
    { tag: tags.bracket, color: "var(--cm-bracket-color)" },
    { tag: tags.brace, color: "var(--cm-bracket-color)" },
    { tag: tags.tagName, color: "var(--cm-tag-color)" },
    { tag: tags.link, color: "var(--cm-link-color)" },
    {
      tag: tags.invalid,
      color: "var(--cm-error-color)",
      background: "var(--cm-error-bg-color)",
    },
  ],
  {
    all: { color: `var(--cm-editor-text-color)` },
    scope: markdownLanguage,
  }
);

let headers = {
  ATXHeading1: "h1",
  ATXHeading2: "h2",
  ATXHeading3: "h3",
  ATXHeading4: "h4",
  ATXHeading5: "h5",
  ATXHeading6: "h6",
};

export let basic_markdown_setup = [
  EditorState.tabSize.of(4),
  indentUnit.of("\t"),
  // syntaxHighlighting(syntax_colors),
  placeholder("The rest is still unwritten..."),
  markdown({ addKeymap: false }),

  EditorView.decorations.compute(["doc"], (state) => {
    try {
      let tree = syntaxTree(state);
      let doc = state.doc;
      let decorations = [];
      iterate_with_cursor({
        tree,
        enter: (cursor) => {
          if (cursor.name === "HeaderMark") {
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "header-mark",
                },
              }).range(cursor.from, cursor.to)
            );
          }
          if (cursor.name in headers) {
            decorations.push(
              Decoration.mark({
                tagName: headers[cursor.name],
              }).range(cursor.from, cursor.to)
            );
          }
          if (cursor.name === "ListItem") {
            let line_from = doc.lineAt(cursor.from);
            let line_to = doc.lineAt(cursor.to);
            decorations.push(
              Decoration.line({
                attributes: {
                  class: "list-item has-list-mark",
                },
              }).range(line_from.from, line_from.from)
            );
            for (let line_number of range(
              line_from.number + 1,
              line_to.number + 1
            )) {
              let line = doc.line(line_number);
              decorations.push(
                Decoration.line({
                  attributes: {
                    class: "list-item",
                  },
                }).range(line.from, line.from)
              );
            }
          }
          if (cursor.name === "ListMark") {
            if (doc.sliceString(cursor.to, cursor.to + 1) !== " ") {
              return;
            }
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "list-mark",
                },
              }).range(cursor.from, cursor.to)
            );
          }
          if (cursor.name === "HardBreak") {
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "hard-break",
                },
              }).range(cursor.from, cursor.to)
            );
          }
          if (cursor.name === "CodeMark") {
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "code-mark",
                },
              }).range(cursor.from, cursor.to)
            );
          }
          if (cursor.name === "HorizontalRule") {
            decorations.push(
              Decoration.replace({
                widget: new ReactWidget(<span className="hr" />),
              }).range(cursor.from, cursor.to)
            );
          }

          if (cursor.name === "InlineCode") {
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "inline-code",
                },
              }).range(cursor.from, cursor.to)
            );
          }

          if (cursor.name === "Blockquote") {
            let line_from = doc.lineAt(cursor.from);
            let line_to = doc.lineAt(cursor.to);
            decorations.push(
              Decoration.line({
                attributes: {
                  class: "blockquote",
                },
              }).range(line_from.from, line_from.from)
            );
            for (let line_number of range(
              line_from.number + 1,
              line_to.number + 1
            )) {
              let line = doc.line(line_number);
              decorations.push(
                Decoration.line({
                  attributes: {
                    class: "blockquote",
                  },
                }).range(line.from, line.from)
              );
            }
          }
          if (cursor.name === "QuoteMark") {
            let extra_space = doc.sliceString(cursor.to, cursor.to + 1) === " ";
            decorations.push(
              Decoration.replace({}).range(
                cursor.from,
                cursor.to + (extra_space ? 1 : 0)
              )
            );
          }

          if (cursor.name === "Emphasis") {
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "emphasis",
                },
              }).range(cursor.from, cursor.to)
            );
          }
          if (cursor.name === "StrongEmphasis") {
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "strong-emphasis",
                },
              }).range(cursor.from, cursor.to)
            );
          }
          if (cursor.name === "EmphasisMark") {
            decorations.push(
              Decoration.mark({
                attributes: {
                  class: "emphasis-mark",
                },
              }).range(cursor.from, cursor.to)
            );
          }
        },
      });

      return Decoration.set(decorations, true);
    } catch (error) {
      console.log(`error:`, error);
      return Decoration.none;
    }
  }),

  // TODO Tab should do autocomplete when not selecting/at the beginning of a line
  keymap.of([
    {
      key: "Tab",
      run: indentMore,
      shift: indentLess,
    },
  ]),
  keymap.of(defaultKeymap),
  drawSelection(),

  // awesome_line_wrapping,
];
