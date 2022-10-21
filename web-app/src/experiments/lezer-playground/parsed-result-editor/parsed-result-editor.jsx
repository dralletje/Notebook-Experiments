import { defaultKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  LanguageSupport,
  LRLanguage,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import {
  EditorState,
  RangeSetBuilder,
  RangeValue,
  Text,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { CodeMirror, Extension } from "codemirror-x-react";
import React from "react";
import { dot_gutter } from "../codemirror-dot-gutter.jsx";
import { tags as t } from "@lezer/highlight";
import {
  FoldAllEffect,
  lezer_result_as_lezer_extensions,
} from "./CodemirrorInspector.jsx";
import { parser as inspector_parser } from "@dral/lezer-inspector";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import {
  cursor_to_inspector_lang,
  InspectorMetaFacet,
  inspector_meta_from_tree,
} from "./cursor-to-inspector-lang.js";
import { GenericViewUpdate } from "codemirror-x-react/viewupdate.js";
import { ReactWidget } from "react-codemirror-widget";
import { IonIcon } from "@ionic/react";
import { warning } from "ionicons/icons";

let base_extensions = [
  EditorView.scrollMargins.of(() => ({ top: 32, bottom: 32 })),
  dot_gutter,
  EditorState.tabSize.of(2),
  placeholder("The rest is still unwritten..."),
  bracketMatching({}),
  // TODO Just the commands that are useful for this editor
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),

  search({
    caseSensitive: false,
    top: true,
  }),
  keymap.of(searchKeymap),
];

let inspector_lang = new LanguageSupport(
  LRLanguage.define({
    // @ts-ignore
    parser: inspector_parser,
  })
);

let lezer_syntax_classes = EditorView.theme({
  ".very-important": { color: "#947eff", fontWeight: 700 },
  ".important": { color: "#947eff" },
  ".boring": { color: "#414141", opacity: 0.5 },
  ".property": { color: "#096e5a" },
  ".variable": { color: "#04a0fa" },
  ".literal": { color: "#53f1de" },
  ".comment": { color: "#747474", fontStyle: "italic" },
  ".error": { color: "#ff0000", fontWeight: "bold" },

  // Just boring
  ".cm-content": { color: "#414141" },

  ".boring.literal": { color: "#688f03" },
  ".boring.property": { color: "#04a0fa" },
});

let highlight_extension = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.string, class: "literal" },
    { tag: t.invalid, class: "error" },
    { tag: t.punctuation, class: "boring" },
    { tag: t.variableName, class: "variable" },
    { tag: t.propertyName, class: "property" },
    { tag: t.meta, class: "boring" },
  ])
);

class WarningSignWidget extends ReactWidget {
  constructor() {
    super(
      <IonIcon style={{ color: "red", pointerEvents: "none" }} icon={warning} />
    );
  }
  eq() {
    return true;
  }
}

class PositionRange extends RangeValue {}
let POSITION_RANGE = new PositionRange();
let hide_positions = [
  EditorView.decorations.compute(["doc"], (state) => {
    let decorations = [];
    iterate_over_cursor({
      cursor: syntaxTree(state).cursor(),
      enter: (cursor) => {
        if (cursor.name === "Error") {
          decorations.push(
            Decoration.replace({ widget: new WarningSignWidget() }).range(
              cursor.from,
              cursor.to
            )
          );
        }
      },
    });
    return Decoration.set(decorations);
  }),

  EditorView.decorations.compute(["doc"], (state) => {
    let decorations = [];
    iterate_over_cursor({
      cursor: syntaxTree(state).cursor(),
      enter: (cursor) => {
        if (cursor.name === "Position") {
          decorations.push(
            Decoration.replace({}).range(cursor.from, cursor.to)
          );
        }
      },
    });
    return Decoration.set(decorations);
  }),
  EditorView.atomicRanges.of((view) => {
    let ranges = new RangeSetBuilder();
    iterate_over_cursor({
      cursor: syntaxTree(view.state).cursor(),
      enter: (cursor) => {
        if (cursor.name === "Position") {
          // +1 in so the space after it also is in the range,
          // meaning there won't be an awkward second cursor move necessary
          ranges.add(cursor.from, cursor.to + 1, POSITION_RANGE);
        }
      },
    });
    return ranges.finish();
  }),
];

/**
 * @param {{
 *  code_to_parse: string,
 *  parser: import("@lezer/lr").LRParser,
 *  code_to_parse_viewupdate: GenericViewUpdate,
 *  onSelection: (selection: readonly [number, number]) => void,
 * }} props
 */
export let ParsedResultEditor = ({
  code_to_parse,
  parser,
  onSelection,
  code_to_parse_viewupdate,
}) => {
  let parsed_as_js = React.useMemo(() => {
    let tree = parser.parse(code_to_parse);
    let { lines } = cursor_to_inspector_lang(tree.cursor());
    return Text.of(lines);
  }, [parser, code_to_parse]);

  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc: parsed_as_js,
      extensions: [base_extensions],
    });
  }, []);

  /** @type {import("react").MutableRefObject<EditorView>} */
  let codemirror_ref = React.useRef(/** @type {any} */ (null));

  React.useLayoutEffect(() => {
    codemirror_ref.current.dispatch({
      changes: {
        from: 0,
        to: codemirror_ref.current.state.doc.length,
        insert: parsed_as_js,
      },
      filter: false,
    });
  }, [parsed_as_js]);

  // Highlight the node that is currently selected in the what-to-parse editor
  React.useEffect(() => {
    for (let transaction of code_to_parse_viewupdate.transactions) {
      let annotation = transaction.annotation(Transaction.userEvent);
      if (annotation == null || !annotation.startsWith("select")) return;

      let selection = code_to_parse_viewupdate.state.selection.main;
      let meta = codemirror_ref.current.state.facet(InspectorMetaFacet);
      for (let index of range(meta.length - 1, -1)) {
        let {
          original: [from, to],
          cursor,
        } = meta[index];
        if (from <= selection.from && selection.to <= to) {
          codemirror_ref.current.dispatch({
            selection: {
              anchor: cursor[0],
              head: cursor[1],
            },
            scrollIntoView: true,
            effects: [FoldAllEffect.of(null)],
          });
          return;
        }
      }
    }
  }, [code_to_parse_viewupdate]);

  // Other way around: highlight the node in the what-to-parse editor that is currently selected in the parsed editor
  let update_what_to_code_selection = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      for (let transaction of update.transactions) {
        let annotation = transaction.annotation(Transaction.userEvent);
        if (annotation == null || !annotation.startsWith("select")) return;

        let meta = update.view.state.facet(InspectorMetaFacet);
        let selection = update.view.state.selection.main;
        for (let index of range(meta.length - 1, -1)) {
          let {
            original,
            cursor: [from, to],
          } = meta[index];
          if (from <= selection.from && selection.to <= to) {
            onSelection(original);
            return;
          }
        }
      }
    });
  }, [onSelection]);

  return (
    <CodeMirror ref={codemirror_ref} state={initial_editor_state}>
      <Extension extension={inspector_lang} />
      <Extension extension={highlight_extension} />
      <Extension extension={lezer_result_as_lezer_extensions} />
      <Extension extension={lezer_syntax_classes} />
      <Extension extension={hide_positions} />

      <Extension extension={update_what_to_code_selection} />
      <Extension extension={inspector_meta_from_tree} />
    </CodeMirror>
  );
};
