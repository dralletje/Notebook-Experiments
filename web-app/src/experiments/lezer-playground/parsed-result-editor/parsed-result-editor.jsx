import { defaultKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState, Prec } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import { DecorationsFromTree } from "@dral/dral-codemirror-helpers";
import { CodeMirror, Extension } from "codemirror-x-react";
import React from "react";
import { dot_gutter } from "../codemirror-dot-gutter.jsx";
import { tags as t } from "@lezer/highlight";
import { lezer_as_javascript_plugins } from "./CodemirrorInspector.jsx";

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

let Decorate_New_Error = Prec.highest(
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "NewExpression") {
      mutable_decorations.push(
        Decoration.mark({ class: "error" }).range(cursor.from, cursor.to)
      );
    }
  })
);

let lezer_result_syntax_classes = EditorView.theme({
  ".very-important": { color: "#ffb4fb", fontWeight: 700 },
  ".important": { color: "#ffb4fb" },
  ".boring": { color: "#2c402d" },
  ".property": { color: "#cb00d7" },
  ".variable": { color: "#0d6801" },
  ".literal": { color: "#00c66d" },
  ".comment": { color: "#747474", fontStyle: "italic" },
  ".error": { color: "#860101", fontStyle: "italic" },
});

let my_highlighting = [
  lezer_result_syntax_classes,
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.string, class: "literal" },
      { tag: t.variableName, class: "variable" },
      { tag: t.punctuation, class: "boring" },
    ])
  ),
];

/**
 * @param {{
 *  code_to_parse: string,
 *  parser: import("@lezer/lr").LRParser,
 *  cursor_to_javascript: import("./cursor-to-javascript.js").cursor_to_javascript,
 * }} props
 */
export let _ParsedResultEditor = ({
  code_to_parse,
  parser,
  cursor_to_javascript,
}) => {
  let parsed_as_js = React.useMemo(() => {
    try {
      let tree = parser.parse(code_to_parse);
      return cursor_to_javascript(tree.cursor());
    } catch (error) {
      return error.message;
    }
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

  return (
    <CodeMirror ref={codemirror_ref} state={initial_editor_state}>
      <Extension extension={Decorate_New_Error} />
      <Extension extension={my_highlighting} />
      <Extension extension={lezer_as_javascript_plugins} />
    </CodeMirror>
  );
};

let CursorToJavascriptHOC = React.lazy(() =>
  import("./higher-order-component-to-import-prettier.jsx")
);

/** @param {Omit<Parameters<_ParsedResultEditor>[0], "cursor_to_javascript">} props */
export let ParsedResultEditor = (props) => {
  return (
    <CursorToJavascriptHOC>
      {(cursor_to_javascript) => (
        <_ParsedResultEditor
          {...props}
          cursor_to_javascript={cursor_to_javascript}
        />
      )}
    </CursorToJavascriptHOC>
  );
};
