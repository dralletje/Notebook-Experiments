import React from "react";
import { RangeSetBuilder, RangeValue } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

import {
  DecorationsFromTree,
  DecorationsFromTreeSortForMe,
} from "@dral/codemirror-helpers";
import { ReactWidget } from "@dral/react-codemirror-widget";
import { iterate_with_cursor } from "dral-lezer-helpers";

let markdown_styling_base_theme = EditorView.baseTheme({
  "h1, h2, h3, h4, h5, h6": {
    display: "inline",
  },
  h1: {
    "font-size": "2em",
    "font-weight": "bold",
    ".cm-line:has(&)": {
      "padding-top": `0.2em`,
      "padding-bottom": `0.3em`,
    },
  },
  h2: {
    "font-size": "1.5em",
    "font-weight": "bold",
    ".cm-line:has(&)": {
      "padding-top": `0.2em`,
      "padding-bottom": `0.2em`,
    },
  },
  h3: {
    "font-size": "1.25em",
    "font-weight": "bold",
    ".cm-line:has(&)": {
      "padding-top": `0.2em`,
      "padding-bottom": `0.1em`,
    },
  },

  ".cm-line": {
    "&:has(.header-mark)": {
      "margin-left": "-24px",
    },
  },

  ".header-mark": {
    "font-variant-numeric": "tabular-nums",
    // "margin-left": "calc(-1.8em - 5px)",
    opacity: 0.3,
    "font-size": "0.8em",
    width: "20px",
    display: "inline-block",
    // display: "inline-block",
    // "&.header-mark-h1": {
    //   "margin-right": "5px",
    //   "margin-left": "calc(-1.8em - 6px)",
    // },
    // "&.header-mark-h2": {
    //   "margin-right": "7px",
    // },
    // "&.header-mark-h3": {
    //   "margin-right": "9px",
    // },
    // "&.header-mark-h4": {
    //   "margin-right": "10px",
    // },
    // "&.header-mark-h5": {
    //   "margin-right": "11px",
    // },
    // "&.header-mark-h6": {
    //   "margin-right": "12px",
    // },
  },
  ".header-mark-space": {
    width: "4px",
    display: "inline-block",

    // ".header-mark-h1 &": {
    //   height: "2em",
    // },
  },
});

class EZRange extends RangeValue {
  eq() {
    return true;
  }
}

let headers = {
  ATXHeading1: "h1",
  ATXHeading2: "h2",
  ATXHeading3: "h3",
  ATXHeading4: "h4",
  ATXHeading5: "h5",
  ATXHeading6: "h6",
};

let decorations = DecorationsFromTreeSortForMe(
  ({ cursor, doc, mutable_decorations: decorations }) => {
    if (cursor.name === "HeaderMark") {
      let node = cursor.node;
      let header_tag = node.parent ? headers[node.parent.name] : "h1";
      if (header_tag == null) return;

      if (doc.sliceString(cursor.to, cursor.to + 1) !== " ") {
        // No space after header, so not _yet_ an header for me
        return;
      }

      decorations.push(
        Decoration.replace({
          inclusive: false,
          widget: new ReactWidget(
            (
              <span style={{ fontSize: "1em" }}>
                <span className={`header-mark header-mark-${header_tag}`}>
                  {header_tag}
                </span>
              </span>
            )
          ),
        }).range(cursor.from, cursor.to)
      );
      decorations.push(
        Decoration.replace({
          widget: new ReactWidget(<span className={`header-mark-space`} />),
        }).range(cursor.to, cursor.to + 1)
      );
    }
    if (cursor.name in headers) {
      if (!doc.sliceString(cursor.from, cursor.to).includes(" ")) {
        // No space after header, so not _yet_ an header for me
        return;
      }
      decorations.push(
        Decoration.mark({
          tagName: headers[cursor.name],
        }).range(cursor.from, cursor.to)
      );
    }
  }
);

export let markdown_headers = [
  markdown_styling_base_theme,

  decorations,

  EditorView.atomicRanges.of(({ state }) => {
    let tree = syntaxTree(state);
    let ranges = new RangeSetBuilder();
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "HeaderMark") {
          ranges.add(cursor.from, cursor.to, new EZRange());
        }
      },
    });
    return ranges.finish();
  }),
];
