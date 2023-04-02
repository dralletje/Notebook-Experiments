import { defaultKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  HighlightStyle,
  Language,
  LanguageSupport,
  LRLanguage,
  syntaxHighlighting,
  syntaxTree,
  syntaxTreeAvailable,
} from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import {
  EditorSelection,
  EditorState,
  RangeSetBuilder,
  RangeValue,
  SelectionRange,
  Text,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
  scrollPastEnd,
} from "@codemirror/view";
import { CodeMirror, Extension } from "codemirror-x-react";
import React from "react";
import { dot_gutter } from "../should-be-shared/codemirror-dot-gutter.jsx";
import { tags as t } from "@lezer/highlight";
import {
  FoldAllEffect,
  lezer_result_as_lezer_extensions,
  node_that_contains_selection_field,
} from "./CodemirrorInspector.jsx";
import { parser as inspector_parser } from "@dral/lezer-inspector";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { range } from "lodash-es";
import {
  cursor_to_inspector_lang,
  inspector_meta_from_tree,
  _cursor_to_inspector_lang,
} from "./cursor-to-inspector-lang.js";
import { GenericViewUpdate } from "codemirror-x-react/viewupdate.js";
import { ReactWidget } from "@dral/react-codemirror-widget";
import { IoWarning } from "react-icons/io5";
import { LanguageStateField } from "@dral/codemirror-helpers";
import { Failure, Loading, usePromise } from "../use/OperationMonadBullshit.js";
import { Tree } from "@lezer/common";

import {
  ScrollIntoViewButOnlyTheEditor,
  ScrollIntoViewButOnlyTheEditorEffect,
} from "../should-be-shared/ScrollIntoViewButOnlyTheEditor";

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
    caseSensitive: true,
    top: true,
  }),
  keymap.of(searchKeymap),

  EditorView.theme({
    ".cm-content": {
      "caret-color": "white",
    },
  }),

  scrollPastEnd(),
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
  ".variable": { color: "#00cc4c" },
  ".literal": { color: "#53f1de" },
  ".comment": { color: "#747474", fontStyle: "italic" },
  ".error": { color: "#ff0000", fontWeight: "bold" },

  // Just boring
  ".cm-content": { color: "#414141" },

  ".meta": { opacity: 0.5 },
  ".meta.literal": { color: "#688f03" },
  ".meta.property": { color: "#04a0fa" },
  ".cm-line:hover .meta, .cm-line:has(.VERY-FOCUSSED) .meta": {
    opacity: 1,
  },
});

let highlight_extension = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.string, class: "literal" },
    { tag: t.invalid, class: "error" },
    { tag: t.punctuation, class: "boring" },
    { tag: t.variableName, class: "variable" },
    { tag: t.propertyName, class: "property" },
    { tag: t.meta, class: "meta" },
  ])
);

class WarningSignWidget extends ReactWidget {
  constructor() {
    super(
      <IoWarning
        key="warning"
        style={{ color: "red", pointerEvents: "none" }}
      />
    );
  }
  eq() {
    return true;
  }
  toDOM(view) {
    let span = super.toDOM(view);
    span.style.pointerEvents = "none";
    return span;
  }
}

/** @param {GenericViewUpdate} viewupdate */
let useExplicitSelection = (viewupdate) => {
  let last_explicit_selection = React.useRef(
    /** @type {SelectionRange?} */ (null)
  );

  for (let transaction of viewupdate.transactions) {
    let annotation = transaction.annotation(Transaction.userEvent);
    if (
      (annotation != null && annotation.startsWith("select")) ||
      transaction.docChanged
    ) {
      last_explicit_selection.current = viewupdate.state.selection.main;
    } else if (transaction.selection != null) {
      // Not sure about this one yet,
      // TODO Might want a specific annotation here
      last_explicit_selection.current = null;
    }
  }
  return last_explicit_selection.current;
};

class PositionRange extends RangeValue {}
let POSITION_RANGE = new PositionRange();
let hide_positions = [
  EditorView.decorations.compute([LanguageStateField], (state) => {
    let decorations = [];
    iterate_over_cursor({
      cursor: syntaxTree(state).cursor(),
      enter: (cursor) => {
        if (cursor.name === "Error") {
          if (cursor.from >= cursor.to) {
            console.log(`Cursor from ${cursor.from} to ${cursor.to} 🤔`);
            return;
          }
          decorations.push(
            Decoration.replace({
              widget: new WarningSignWidget(),
              inclusive: true,
            }).range(cursor.from, cursor.to)
          );
        }
      },
    });
    return Decoration.set(decorations);
  }),

  EditorView.decorations.compute([LanguageStateField], (state) => {
    let decorations = [];
    // console.time("Hide positions from tree");
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
    // console.timeEnd("Hide positions from tree");
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
    let set = ranges.finish();
    return set;
  }),
];

let get_tree_immediately = (state, parser) => {
  if (parser == null) return Tree.empty;
  try {
    return parser.parse(state.doc.toString());
  } catch (error) {
    return Tree.empty;
  }
};

let requestIdleCallback = (fn) => {
  if ("requestIdleCallback" in window) {
    return window.requestIdleCallback(fn);
  } else {
    // @ts-expect-error - TS doesn't know requestIdleCallback isn't always present
    return window.setTimeout(fn, 0);
  }
};
let cancelIdleCallback = (id) => {
  if ("cancelIdleCallback" in window) {
    return window.cancelIdleCallback(id);
  } else {
    // @ts-expect-error - TS doesn't know requestIdleCallback isn't always present
    return window.clearTimeout(id);
  }
};

let requestIdlePromise = async (signal) => {
  await new Promise((resolve) => requestIdleCallback(resolve));
  if (signal.aborted) {
    await new Promise(() => {});
  }
};

let selected_node_from_code_to_parse_selection = (meta, selection) => {
  if (selection == null) return null;

  let match = null;
  for (let index of range(meta.length - 1, -1)) {
    let {
      original: [from, to],
      cursor,
    } = meta[index];
    if (match == null && from <= selection.from && selection.to <= to) {
      match = cursor;
    } else if (selection.to === to) {
      match = cursor;
    } else if (to < selection.to) {
      break;
    }
  }
  return match == null
    ? null
    : {
        anchor: match[0],
        head: match[1],
      };
};

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
  let container_ref = React.useRef(null);
  let code_to_parse_selection = useExplicitSelection(code_to_parse_viewupdate);

  let initial_editor_state = React.useMemo(() => {
    let tree = get_tree_immediately(code_to_parse_viewupdate.state, parser);
    let { lines } = cursor_to_inspector_lang(tree.cursor());
    return EditorState.create({
      doc: Text.of(lines),
      extensions: [base_extensions],
    });
  }, []);

  /** @type {import("react").MutableRefObject<EditorView>} */
  let codemirror_ref = React.useRef(/** @type {any} */ (null));

  let result = usePromise(
    async (signal) => {
      // Very basic debounce
      await requestIdlePromise(signal);

      let tree = get_tree_immediately(code_to_parse_viewupdate.state, parser);

      await requestIdlePromise(signal);

      let { lines } = cursor_to_inspector_lang(tree.cursor());
      let parsed_as_js = Text.of(lines);

      await requestIdlePromise(signal);

      let state = codemirror_ref.current.state;
      let { anchor, head } = state.selection.main;

      let spec = {
        changes: {
          from: 0,
          to: state.doc.length,
          insert: parsed_as_js,
        },
        filter: false,
      };

      let transaction;
      console.groupCollapsed("FAKE UPDATE");
      try {
        console.log(`> So this is funny:
> I'm asking for a state update with the new doc
> so I can get the new language state...
> But it is also re-running all the extensions
> and decorations and stuff! Stupid!!
> TODO Need to figure out a way to not have to do this,
> but still get the new language state...
>
> Stuff that follows are logs posted during this fake update:`);
        transaction = state.update(spec);
        transaction.state;
      } finally {
        console.groupEnd();
      }
      let language_state = transaction.state.field(LanguageStateField);
      let LanguageState = language_state.constructor;
      let new_context = language_state.context;
      while (!new_context.isDone(transaction.state.doc.length)) {
        new_context.work(5, transaction.state.doc.length);
        await requestIdlePromise(signal);
      }
      new_context.takeTree();
      // @ts-expect-error ARGggg
      let new_language_state = new LanguageState(new_context);

      let meta = inspector_meta_from_tree(
        transaction.state.doc,
        new_context.tree
      );

      let code_to_parse_selection =
        code_to_parse_viewupdate.state.selection.main;
      let explicit_selection = selected_node_from_code_to_parse_selection(
        meta,
        code_to_parse_selection
      );
      let new_selection = explicit_selection ?? {
        anchor: Math.min(anchor, parsed_as_js.length),
        head: Math.min(head, parsed_as_js.length),
      };

      try {
        codemirror_ref.current.dispatch({
          ...spec,
          effects: [
            ...(explicit_selection != null ? [FoldAllEffect.of(null)] : []),
            // @ts-expect-error Using Language.setState which is ~~private~~
            Language.setState.of(new_language_state),
            ScrollIntoViewButOnlyTheEditorEffect.of({
              position: Math.min(new_selection.anchor, new_selection.head),
            }),
          ],
          selection: new_selection,
        });
      } finally {
        console.groupEnd();
      }
    },
    [code_to_parse_viewupdate.state.doc, parser]
  );

  if (result instanceof Failure) {
    result.get(); // Throw the error
  }

  // Highlight the node that is currently selected in the what-to-parse editor
  React.useEffect(() => {
    // If docChanged, we wait for the above effect to update the selection
    // after it changed the doc and everything
    for (let transaction of code_to_parse_viewupdate.transactions) {
      if (transaction.docChanged) {
        return;
      }
    }

    let idle_callback = 0;
    // Hacky solution to wait for syntaxTree to become available
    let try_parse = () => {
      let selection = code_to_parse_selection;
      if (selection == null) return;

      if (!syntaxTreeAvailable(codemirror_ref.current.state)) {
        idle_callback = requestIdleCallback(() => {
          try_parse();
        });
        return;
      }

      let tree = syntaxTree(codemirror_ref.current.state);
      let meta = inspector_meta_from_tree(
        codemirror_ref.current.state.doc,
        tree
      );
      let new_selection = selected_node_from_code_to_parse_selection(
        meta,
        code_to_parse_selection
      );

      if (new_selection != null) {
        codemirror_ref.current.dispatch({
          selection: new_selection,
          // TODO Scroll only the editor, not the rest of the page? 🤔
          // scrollIntoView: inView,
          effects: [
            FoldAllEffect.of(null),
            ScrollIntoViewButOnlyTheEditorEffect.of({
              position: Math.min(new_selection.anchor, new_selection.head),
            }),
          ],
        });
      } else {
        let simple = codemirror_ref.current.state.selection.main.head;
        codemirror_ref.current.dispatch({
          selection: EditorSelection.cursor(simple),
        });
      }
    };
    try_parse();
    return () => cancelIdleCallback(idle_callback);
  }, [code_to_parse_selection]);

  // Other way around: highlight the node in the what-to-parse editor that is currently selected in the parsed editor
  let update_what_to_code_selection = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      for (let transaction of update.transactions) {
        let annotation = transaction.annotation(Transaction.userEvent);
        if (annotation == null || !annotation.startsWith("select")) return;

        // TODO This one can be a lot more effecient because I can "just" get the node currently at the cursor,
        // .... and from there go up to look around for the corresponsing position.
        let tree = syntaxTree(update.state);
        let meta = inspector_meta_from_tree(update.view.state.doc, tree);
        let selection = update.view.state.field(
          node_that_contains_selection_field
        );
        if (selection == null) return;

        // let selection = update.view.state.selection.main;
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
    <div
      ref={container_ref}
      style={{
        height: "100%",
        opacity: result instanceof Loading ? 0.5 : 1,
        transition:
          result instanceof Loading ? "opacity 0.5s ease 0.2s" : "opacity 0.2s",
      }}
    >
      <CodeMirror ref={codemirror_ref} state={initial_editor_state}>
        <Extension extension={inspector_lang} />
        <Extension extension={ScrollIntoViewButOnlyTheEditor} />
        <Extension extension={highlight_extension} />
        <Extension extension={lezer_syntax_classes} />
        <Extension extension={hide_positions} />

        <Extension extension={update_what_to_code_selection} />
        <Extension extension={lezer_result_as_lezer_extensions} />
      </CodeMirror>
    </div>
  );
};
