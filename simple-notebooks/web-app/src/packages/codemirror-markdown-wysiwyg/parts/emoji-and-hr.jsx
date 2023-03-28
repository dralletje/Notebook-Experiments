import React from "react";
import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView } from "@codemirror/view";
import emoji from "node-emoji";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { ReactWidget } from "react-codemirror-widget";
import { RangeSetBuilder, RangeValue } from "@codemirror/state";

class EZRange extends RangeValue {
  eq() {
    return true;
  }
}

export let markdown_emoji_and_hr = [
  EditorView.baseTheme({
    ".hr": {
      "border-top": "1px solid rgba(255, 255, 255, 0.2)",
      display: "inline-block",
      width: "100%",
      "vertical-align": "middle",
    },
    ".emoji": {
      color: "var(--accent-color)",
      "font-style": "italic",
    },
  }),

  EditorView.decorations.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let decorations = [];
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "HorizontalRule") {
          let line = doc.lineAt(cursor.from);
          decorations.push(
            Decoration.replace({
              widget: new ReactWidget(<hr />),
              inclusive: true,
            }).range(line.from, line.to)
          );
        }

        if (cursor.name === "Emoji") {
          let text = doc.sliceString(cursor.from, cursor.to);
          if (emoji.hasEmoji(text)) {
            let emoji_text = emoji.get(text);
            decorations.push(
              Decoration.replace({
                widget: new ReactWidget(<span>{emoji_text}</span>),
              }).range(cursor.from, cursor.to)
            );
          } else {
            decorations.push(
              Decoration.mark({
                class: "emoji",
              }).range(cursor.from, cursor.to)
            );
          }
        }
      },
    });
    return Decoration.set(decorations);
  }),
  EditorView.atomicRanges.of(({ state }) => {
    let tree = syntaxTree(state);
    let doc = state.doc;
    let ranges = new RangeSetBuilder();
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "HorizontalRule") {
          ranges.add(cursor.from, cursor.to, new EZRange());
        }

        if (cursor.name === "Emoji") {
          let text = doc.sliceString(cursor.from, cursor.to);
          if (emoji.hasEmoji(text)) {
            ranges.add(cursor.from, cursor.to, new EZRange());
          }
        }
      },
    });
    return ranges.finish();
  }),
];
