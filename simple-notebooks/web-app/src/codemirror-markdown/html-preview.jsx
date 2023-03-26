import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit, syntaxTree } from "@codemirror/language";

import {
  EditorState,
  RangeSetBuilder,
  RangeValue,
  Range,
  Facet,
  StateField,
  StateEffect,
  StateEffectType,
  MapMode,
  EditorSelection,
} from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, indentLess, indentMore } from "@codemirror/commands";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { iterate_over_cursor, iterate_with_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { ReactWidget, useEditorView } from "react-codemirror-widget";
import React from "react";
import emoji from "node-emoji";

import { IonIcon } from "@ionic/react";
import { eyeOutline, eye } from "ionicons/icons";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

class EZRange extends RangeValue {
  eq() {
    return true;
  }
}

let ToggleHTMLMarkerWidget = ({ show_html, line_number }) => {
  let view = useEditorView();

  return (
    <span
      onClick={() => {
        view.dispatch({
          effects: toggle_html_demo_effect.of({
            line: line_number,
            show: !show_html,
          }),
        });
      }}
      className="html-previous-toggle"
    >
      <IonIcon icon={show_html ? eye : eyeOutline} />
    </span>
  );
};

let HTMLPreviewWidget = ({ html, show_html, line_number }) => {
  return (
    <div>
      <div style={{ fontSize: "0.8em", transform: "translateX(4px)" }}>
        <ToggleHTMLMarkerWidget
          line_number={line_number}
          show_html={show_html}
        />
      </div>

      <div
        style={{
          // backgroundColor: "rgba(255,255,255,0.05)",
          whiteSpace: "normal",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

/** @type {StateEffectType<{ line: number, show: boolean }>} */
let toggle_html_demo_effect = StateEffect.define();

class HTMLBlockRange extends RangeValue {
  eq(x) {
    return true;
  }
}
let html_block_range = new HTMLBlockRange();

/** @type {Facet<Array<Range<HTMLBlockRange>>, Array<Range<HTMLBlockRange>>>} */
let html_blocks_facet = Facet.define({
  combine: (x) => x[0],
});

let html_demo_statefield = StateField.define({
  create(state) {
    let intitial_html_blocks = state.facet(html_blocks_facet);
    return new Map(
      intitial_html_blocks.map((x) => [state.doc.lineAt(x.from).number, true])
    );
  },
  update(value, tr) {
    let new_map = null;

    if (tr.docChanged) {
      for (let [old_line, show] of value) {
        let old_pos = tr.startState.doc.line(old_line).from;
        let new_pos = tr.changes.mapPos(old_pos, 0, MapMode.Simple);
        let new_line =
          new_pos == null ? null : tr.newDoc.lineAt(new_pos).number;
        if (new_line !== old_line) {
          if (new_map == null) new_map = new Map(value);

          new_map.delete(old_line);
          if (new_pos) {
            new_map.set(new_line, show);
          }
        }
      }
    }

    for (let effect of tr.effects) {
      if (effect.is(toggle_html_demo_effect)) {
        if (new_map == null) {
          new_map = new Map(value);
        }
        if (effect.value.show === true) {
          new_map.set(effect.value.line, effect.value.show);
        } else {
          new_map.delete(effect.value.line);
        }
      }
    }

    if (new_map == null) {
      return value;
    } else {
      return new_map;
    }
  },
});

export let html_preview_extensions = [
  EditorView.baseTheme({
    /* I apply this to the line because else the line will stay high, making
     the code look really fragile */
    ".cm-line:has(.html)": {
      "font-size": "0.8em",
      color: "#2fbf00",
    },
    ".html-previous-toggle": {
      position: "absolute",
      transform: "translateX(-100%) translateX(-10px) translateY(5px)",
      "font-size": "0.8em",
      color: "#2fbf00",
      opacity: "0.5",
    },
    ".html-previous-toggle:hover": {
      opacity: "1",
      cursor: "pointer",
    },
  }),
  html_blocks_facet.compute(["doc"], (state) => {
    let tree = syntaxTree(state);
    let ranges = [];
    iterate_with_cursor({
      tree,
      enter: (cursor) => {
        if (cursor.name === "HTMLBlock") {
          ranges.push(html_block_range.range(cursor.from, cursor.to));
        }
      },
    });
    return ranges;
  }),
  EditorView.decorations.compute(
    [html_blocks_facet, html_demo_statefield],
    (state) => {
      let doc = state.doc;
      let decorations = [];
      let html_ranges = state.facet(html_blocks_facet);

      for (let range of html_ranges) {
        let show_html_for_line = state.field(html_demo_statefield);
        let line_number = doc.lineAt(range.from).number;
        let show_html = show_html_for_line.get(line_number) ?? false;

        if (show_html) {
          decorations.push(
            Decoration.replace({
              block: true,
              inclusive: true,
              // inclusiveEnd: false,
              widget: new ReactWidget(
                (
                  <HTMLPreviewWidget
                    show_html={show_html}
                    line_number={line_number}
                    html={doc.sliceString(range.from, range.to)}
                  />
                )
              ),
              side: 1,
            }).range(range.from, range.to)
          );
        } else {
          decorations.push(
            Decoration.widget({
              widget: new ReactWidget(
                (
                  <ToggleHTMLMarkerWidget
                    show_html={show_html}
                    line_number={line_number}
                  />
                )
              ),
              side: -1,
            }).range(range.from, range.from)
          );
          decorations.push(
            Decoration.mark({
              tagName: "span",
              class: "html",
            }).range(range.from, range.to)
          );
        }
      }

      return Decoration.set(decorations, true);
    }
  ),
  EditorView.atomicRanges.of(({ state }) => {
    let doc = state.doc;
    let ranges = new RangeSetBuilder();
    let html_ranges = state.facet(html_blocks_facet);

    for (let range of html_ranges) {
      // Seperate because it uses `html_demo_statefield`,
      // not sure if it is better to be separate but feels good
      let show_html_for_line = state.field(html_demo_statefield);

      let line_number = doc.lineAt(range.from).number;
      let show_html = show_html_for_line.get(line_number) ?? false;
      if (show_html) {
        ranges.add(range.from, range.to, new EZRange());
      }
    }
    return ranges.finish();
  }),
  html_demo_statefield,
];
