import React from "react";
import styled from "styled-components";
import { produce, original } from "immer";
import {
  EditorState,
  Facet,
  Prec,
  Range,
  StateEffect,
  StateEffectType,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
  ViewPlugin,
} from "@codemirror/view";
import {
  bracketMatching,
  codeFolding,
  HighlightStyle,
  LanguageSupport,
  LRLanguage,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { LRParser } from "@lezer/lr";
import { IonIcon } from "@ionic/react";
import { bonfire, bonfireOutline } from "ionicons/icons";
import usePath from "react-use-path";
import { javascriptLanguage } from "@codemirror/lang-javascript";

import { CodeMirror, Extension } from "codemirror-x-react";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import { ReactWidget, useEditorView } from "react-codemirror-widget";
import { LezerGeneratorWorker } from "@dral/lezer-generator-worker/lezer-generator-worker.js";
import { TransformJavascriptWorker } from "@dral/dralbook-transform-javascript/worker/transform-javascript-worker.js";

////////////////////
import {
  basic_javascript_setup,
  javascript_syntax_highlighting,
} from "../../codemirror-javascript-setup.js";
import { DecorationsFromTree } from "../../basic-markdown-setup.jsx";
////////////////////

import { lezer_syntax_extensions } from "./editors/lezer-editor.js";
import { cursor_to_javascript } from "./cursor-to-javascript.js";
import {
  Failure,
  Loading,
  Success,
  useMemoizeSuccess,
  usePromise,
} from "./use/OperationMonadBullshit.js";
import { useWorker, useWorkerPool } from "./use/useWorker.js";
import { ScopedStorage, useScopedStorage } from "./use/scoped-storage.js";
import { dot_gutter } from "./codemirror-dot-gutter.js";
import {
  DEFAULT_JAVASCRIPT_STUFF,
  DEFAULT_PARSER_CODE,
  DEFAULT_TO_PARSE,
} from "./default-field-codes.js";
import "./App.css";

/**
 * @template T
 * @typedef ExecutionResult
 * @type {import("./use/OperationMonadBullshit.js").ExecutionResult<T>}
 */

let base_extensions = [
  EditorView.scrollMargins.of(() => ({ top: 32, bottom: 32 })),
  dot_gutter,

  // Make awesome line wrapping indent wrapped lines a liiiiitle bit (1 character) more than the first line
  // TODO Doesn't seem to work in result editor... (actually shifts every line by 1 character? Weird)
  // EditorView.theme({
  //   ".awesome-wrapping-plugin-the-line": {
  //     "margin-left": "calc(var(--indented) + 1ch)",
  //     "text-indent": "calc(-1 * var(--indented) - 1ch)",
  //   },
  // }),

  EditorState.tabSize.of(2),
  placeholder("The rest is still unwritten..."),
  bracketMatching({}),
  closeBrackets(),
  highlightSelectionMatches(),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),

  search({
    caseSensitive: false,
    top: true,
  }),

  // COUGH SHARED HITORY COUGH
  history(),
  keymap.of(historyKeymap),
  keymap.of(searchKeymap),
];

let position_from_error = (error) => {
  let position_stuff = error?.message?.match?.(/^[^(]* \((\d+):(\d+)\)$/);

  if (position_stuff) {
    let [_, _line, _column] = position_stuff;
    let line = Number(_line);
    let column = Number(_column);
    return { line, column };
  } else {
    return null;
  }
};

/** @param {{ doc: string, onChange: (str: string) => void, result: ExecutionResult<any>, error: Error? }} props */
export let LezerEditor = ({ doc, onChange, result, error }) => {
  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc,
      extensions: [base_extensions],
    });
  }, []);

  let on_change_extension = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });
  }, [onChange]);

  let error_extension = React.useMemo(() => {
    if (error != null) {
      let position = position_from_error(error);
      if (position) {
        let { line, column } = position;
        return EditorView.decorations.of((view) => {
          try {
            let line_start = view.state.doc.line(line).from;
            return Decoration.set(
              Decoration.mark({
                class: "programming-error-oops",
              }).range(line_start + column, line_start + column + 1)
            );
          } catch (error) {
            console.error("Derp:", error);
            return Decoration.none;
          }
        });
      }
    }
    return NO_EXTENSIONS;
  }, [error]);

  return (
    <CodeMirror state={initial_editor_state}>
      <Extension extension={lezer_syntax_extensions} />
      <Extension extension={on_change_extension} />
      <Extension extension={awesome_line_wrapping} />
      <Extension extension={error_extension} />
    </CodeMirror>
  );
};

/** @param {{ doc: string, onChange: (str: string) => void, error: Error? }} props */
export let JavascriptStuffEditor = ({ doc, onChange, error }) => {
  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc,
      extensions: [base_extensions],
    });
  }, []);

  let on_change_extension = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });
  }, [onChange]);

  let error_extension = React.useMemo(() => {
    if (error != null) {
      let position = position_from_error(error);
      if (position) {
        let { line, column } = position;
        return EditorView.decorations.of((view) => {
          try {
            let line_start = view.state.doc.line(line).from;
            return Decoration.set(
              Decoration.mark({
                class: "programming-error-oops",
              }).range(line_start + column, line_start + column + 1)
            );
          } catch (error) {
            console.error("Derp:", error);
            return Decoration.none;
          }
        });
      }
    }
    return NO_EXTENSIONS;
  }, [error]);

  return (
    <CodeMirror state={initial_editor_state}>
      <Extension extension={on_change_extension} />
      <Extension extension={basic_javascript_setup} />
      <Extension extension={error_extension} />
    </CodeMirror>
  );
};

/** @type {Array<import("@codemirror/state").Extension>} */
let NO_EXTENSIONS = [];

/**
 * @param {{
 *  doc: string,
 *  onChange: (str: string) => void,
 *  parser: import("@lezer/lr").LRParser | null,
 *  js_stuff: ExecutionResult<{
 *    extensions: import("@codemirror/state").Extension[],
 *  }>
 * }} props */
export let WhatToParseEditor = ({ doc, onChange, parser, js_stuff }) => {
  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc,
      extensions: [base_extensions],
    });
  }, []);

  let js_result = js_stuff.or(null);

  let parser_extension = React.useMemo(() => {
    if (parser) {
      let language = LRLanguage.define({
        // @ts-ignore
        parser: parser,
      });
      return new LanguageSupport(language);
    } else {
      return EditorView.updateListener.of(() => {});
    }
  }, [parser]);

  let on_change_extension = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });
  }, [onChange]);

  let custom_extensions = js_result?.extensions ?? NO_EXTENSIONS;

  let [exception, set_exception] = React.useState(/** @type {any} */ (null));
  let exceptionSinkExtension = React.useMemo(() => {
    return EditorView.exceptionSink.of((error) => {
      set_exception(error);
    });
  }, [set_exception]);

  if (exception) {
    throw exception;
  }

  return (
    <CodeMirror state={initial_editor_state}>
      <Extension extension={on_change_extension} />
      <Extension extension={parser_extension} />
      <Extension extension={custom_extensions} />
      <Extension extension={exceptionSinkExtension} />
      <Extension extension={awesome_line_wrapping} />

      <Extension extension={let_me_know_what_node_i_clicked} />
    </CodeMirror>
  );
};

let ErrorBox = styled.div`
  color: rgb(181 181 181);
  background-color: #420000;
  padding: 8px;
  padding-top: 0px;
  max-height: 50%;
  overflow: auto;
  font-size: 16px;

  h1 {
    padding-top: 8px;
    padding-bottom: 4px;
    font-weight: bold;
    font-size: 12px;
    background-color: #420000;

    position: sticky;
    top: 0px;
  }

  pre {
    white-space: pre-wrap;
  }
`;

/**
 * @extends {React.Component<Parameters<WhatToParseEditor>[0] & { errors: Array<{ title: string, error: Error }> }, { component_error: Error | null }>}
 */
class WhatToParseEditorWithErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { component_error: null };
    this.last_js_stuff = props.js_stuff;
  }

  static getDerivedStateFromError(error) {
    return { component_error: error };
  }

  render() {
    let { component_error } = this.state;
    let { js_stuff, errors, ...props } = this.props;

    if (this.last_js_stuff != this.props.js_stuff) {
      this.last_js_stuff = this.props.js_stuff;
      if (component_error != null) {
        this.setState({ component_error: null });
      }
    }

    let js_stuff_safe =
      component_error != null || this.props.js_stuff instanceof Failure
        ? Failure.of(new Error("Javascript stuff is not okay"))
        : js_stuff;

    let errors_with_component_error = [
      ...errors,
      ...(component_error != null
        ? [{ title: "CodeMirror error", error: component_error }]
        : []),
    ];

    return (
      <div
        style={{
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <WhatToParseEditor {...props} js_stuff={js_stuff_safe} />
        </div>

        {errors_with_component_error.length > 0 && (
          <ErrorBox>
            {errors_with_component_error.map((error) => (
              <>
                <h1>{error.title}</h1>
                {/* @ts-ignore */}
                <pre>{error.error.message}</pre>
              </>
            ))}
          </ErrorBox>
        )}
      </div>
    );
  }
}

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

let fold_style = EditorView.theme({
  ".fold-me-daddy:not(.folded)": {
    cursor: "pointer",
    "&:hover": {
      "text-decoration": "underline",
      "text-decoration-thickness": "3px",
    },
  },
  ".folded": {
    // color: "#0d6801",
    opacity: "0.5",
    cursor: "pointer",
  },
  ".ellipsis": {
    "font-weight": "bold",
    color: "#8b8b8b",
  },
});

/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
import { SingleEventEmitter } from "single-event-emitter";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { compact, range, sortBy } from "lodash";
/**
 * @typedef TreePosition
 * @type {number[]}
 */
/** @type {SingleEventEmitter<TreePosition | null>} */
let open_specific_node_emitter = new SingleEventEmitter();
/**
 * @param {import("@lezer/common").TreeCursor} cursor
 * @param {[number, number]} position
 */
let cursor_to_tree_position = (cursor, [from, to]) => {
  // if (from !== to) {
  //   to = to + 1;
  // }
  let positions = [];
  parent: do {
    let index = 0;
    do {
      if (cursor.from <= from && to <= cursor.to) {
        // Very hacky way to make sure that if we are at the end of a node,
        // and there is no next node right next to it,
        // we want to select that node.
        // HOWEVER, if there
        if (cursor.to === to) {
          if (cursor.nextSibling()) {
            if (cursor.from === to && from === to) {
              positions.push(index + 1);
              continue parent;
            } else {
              cursor.prevSibling();
              positions.push(index);
              continue parent;
            }
          } else {
            positions.push(index);
            continue parent;
          }
        }

        positions.push(index);
        continue parent;
      }
      index++;
    } while (cursor.nextSibling());
    // throw new Error("Can't find position in tree");
    break;
  } while (cursor.firstChild());
  return positions;
};
/**
 * @param {import("@lezer/common").TreeCursor} cursor
 * @param {TreePosition} position
 * @return {[number, number][]}
 */
let tree_position_to_cursor = (cursor, position) => {
  if (position.length === 0) {
    // TODO Error?
    return [[cursor.from, cursor.to]];
  }

  /** @type {[number, number][]} */
  let rendered_positions = [];

  cursor.firstChild();
  cursor.firstChild();
  parent: for (let index of position.slice(0, -1)) {
    let current_index = 0;
    do {
      if (index === current_index) {
        cursor.firstChild(); // Go into CallExpression, on VariableName
        rendered_positions.push([cursor.from, cursor.to]);
        cursor.nextSibling(); // Onto ArgList
        cursor.firstChild(); // Enter ArgList
        cursor.nextSibling(); // Skip "("
        continue parent;
      }
      current_index++;
      // Skip current node and the "," after it
    } while (cursor.nextSibling() && cursor.nextSibling());
    throw new Error("couldn't find index in tree?");
  }

  // @ts-ignore
  for (let _ of range(0, position.at(-1))) {
    cursor.nextSibling();
    cursor.nextSibling();
  }
  rendered_positions.push([cursor.from, cursor.to]);
  return rendered_positions;
};
let let_me_know_what_node_i_clicked = [
  EditorView.updateListener.of((update) => {
    if (update.selectionSet) {
      let tree = syntaxTree(update.state);
      let cursor = tree.cursor();
      let positions = cursor_to_tree_position(cursor, [
        update.state.selection.main.from,
        update.state.selection.main.to,
      ]);
      open_specific_node_emitter.emit(positions);
    }
  }),
  EditorView.domEventHandlers({
    blur: (view) => {
      open_specific_node_emitter.emit(null);
    },
  }),
];
/** @type {StateEffectType<TreePosition | null>} */
let OpenPositionEffect = StateEffect.define();
let what_to_focus = StateField.define({
  create() {
    return /** @type {readonly [number, number][] | null} */ (null);
  },
  update(value, tr) {
    // TODO Also "focus" on the node you click on:
    // .... Currently does not work because it will also fold it's children >_>
    // if (tr.selection) {
    //   let cursor = syntaxTree(tr.state).cursorAt(tr.selection.main.head);
    //   let positions = /** @type {[number, number][]} */ ([]);
    //   do {
    //     if (cursor.name === "VariableName") {
    //       positions.push([cursor.from, cursor.to]);
    //     }
    //     if (cursor.name === "CallExpression") {
    //       cursor.firstChild();
    //       try {
    //         positions.unshift([cursor.from, cursor.to]);
    //       } finally {
    //         cursor.parent();
    //       }
    //     }
    //   } while (cursor.parent());
    //   return positions;
    // }
    for (let effect of tr.effects) {
      if (effect.is(OpenPositionEffect)) {
        if (effect.value == null) {
          return null;
        }

        try {
          let positions = tree_position_to_cursor(
            syntaxTree(tr.state).cursor(),
            effect.value
          );
          return positions;
        } catch (error) {
          // This isn't that important, so don't crash anything
          console.error("Error in tree_position_to_cursor", error);
        }
      }
    }
    return value;
  },
});
let all_this_just_to_click = [
  ViewPlugin.define((view) => {
    let handle = (position) => {
      view.dispatch({
        effects: OpenPositionEffect.of(position),
      });
    };
    open_specific_node_emitter.on(handle);
    return {
      destroy() {
        open_specific_node_emitter.off(handle);
      },
    };
  }),
  what_to_focus,
  EditorView.theme({
    ".FOCUSSED": {
      filter: "brightness(2)",
    },
    ".VERY-FOCUSSED": {
      filter: "brightness(4)",
    },
  }),
  // Very hacky way to say "JUST FOCUS ON THIS NOW EH"
  // (The selected element wouldn't )
  EditorView.domEventHandlers({
    dblclick: () => {
      // @ts-ignore
      document.activeElement?.blur?.();
    },
  }),
  EditorView.decorations.compute([what_to_focus], (state) => {
    let focus_thing = state.field(what_to_focus);
    if (focus_thing == null) {
      return Decoration.none;
    } else {
      let parents = focus_thing.slice(0, -1);
      let last = focus_thing.at(-1);

      let decorations = [];
      for (let [from, to] of parents) {
        decorations.push(
          Decoration.mark({
            class: "FOCUSSED",
          }).range(from, to)
        );
      }

      if (last) {
        decorations.push(
          Decoration.mark({
            class: "VERY-FOCUSSED",
          }).range(last[0], last[1])
        );
      }
      return Decoration.set(decorations);
    }
  }),
  EditorView.updateListener.of((update) => {
    let plllt = update.state.field(what_to_focus);
    if (
      update.startState.field(what_to_focus, false) !== plllt &&
      plllt !== null
    ) {
      let x = plllt.at(-1)?.[0];
      if (x != null) {
        update.view.dispatch({
          effects: [
            EditorView.scrollIntoView(x, { y: "nearest", x: "nearest" }),
          ],
        });
      }
    }
  }),
];
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////

/**
 * @typedef RangeTuple
 * @type {readonly [number, number]}
 */

/** @type {StateEffectType<{ from: number, to: number }>} */
let FoldEffect = StateEffect.define();
/** @type {StateEffectType<{ from: number, to: number }>} */
let UnfoldEffect = StateEffect.define();
let what_to_fold = StateField.define({
  create() {
    return /** @type {Array<RangeTuple>} */ ([]);
  },
  update(value, tr) {
    if (tr.docChanged) {
      return [];
    }
    let focusmehhh = tr.state.field(what_to_focus);
    if (
      focusmehhh !== tr.startState.field(what_to_focus, false) &&
      focusmehhh != null
    ) {
      let folds = tr.state.facet(AllFoldsFacet);
      // @ts-ignore
      let [from, to] = focusmehhh.at(-1);
      let new_folds = folds
        .filter((x) => {
          return to < x.fold_from || x.fold_to < from;
        })
        .map((x) => /** @type {RangeTuple} */ ([x.fold_from, x.fold_to]));
      return new_folds;
    }

    if (tr.selection != null) {
      let { main } = tr.selection;
      return value.filter(([from, to]) => from > main.from && to < main.to);
    }

    return produce(value, (value) => {
      for (let effect of tr.effects) {
        if (effect.is(FoldEffect)) {
          // Find index of where this fold would fit if sorted by `from`
          let index = Math.max(
            value.findIndex((x) => x[0] < effect.value.from) - 1,
            0
          );
          value.splice(index, 0, [effect.value.from, effect.value.to]);
          // value.push([effect.value.from, effect.value.to]);
        }
        if (effect.is(UnfoldEffect)) {
          let index = value.findIndex(
            ([from, to]) => from === effect.value.from && to === effect.value.to
          );
          if (index !== -1) {
            value.splice(index, 1);
          }
        }
      }
    });
  },
  // provide: (value) => EditorView.decorations.from(value, (value) => Decoration.none)
});

let FoldedRegion = ({ from, to }) => {
  let view = useEditorView();

  return (
    <span
      className="ellipsis"
      // data-from={from}
      // data-to={to}
      onClick={() => {
        view.dispatch({
          effects: UnfoldEffect.of({ from, to }),
        });
      }}
    >
      <span className="ellipsis">{" … "}</span>
    </span>
  );
};

/**
 * @typedef FoldableCall
 * @type {{
 *  from: number,
 *  to: number,
 *  fold_from: number,
 *  fold_to: number,
 * }}
 */

/** @type {Facet<FoldableCall[], FoldableCall[]>} */
let AllFoldsFacet = Facet.define({
  combine: (values) => values[0],
});

let lezer_as_javascript_plugins = [
  new LanguageSupport(javascriptLanguage),
  codeFolding(),
  all_this_just_to_click,
  what_to_fold,
  fold_style,
  AllFoldsFacet.compute(["doc"], (state) => {
    let cursor = syntaxTree(state).cursor();
    /** @type {FoldableCall[]} */
    let ranges = [];
    iterate_over_cursor({
      cursor: cursor,
      enter: (cursor) => {
        if (cursor.name === "CallExpression") {
          let node = cursor.node;
          let callee = node.firstChild;
          let arg_list = node.getChild("ArgList");

          if (callee == null || arg_list == null) return;

          ranges.push({
            from: callee.from,
            to: callee.to,
            fold_from: arg_list.from + 1,
            fold_to: arg_list.to - 1,
          });
        }
      },
    });
    return ranges;
  }),
  EditorView.decorations.compute([what_to_fold], (state) => {
    let folds = state.field(what_to_fold);
    let decorations = /** @type {Array<Range<Decoration>>} */ ([]);

    let did_fold = /** @type {Array<[from: number, to: number]>} */ ([]);
    for (let [from, to] of folds) {
      if (did_fold.some(([f, t]) => f <= from && to <= t)) {
        continue;
      }
      did_fold.push([from, to]);
      decorations.push(Decoration.mark({ class: "folded" }).range(from, to));

      // Find first 20 characters without counting tabs, newlines and spaces
      let text = state.sliceDoc(from, to);
      let character_to_show_in_front = 0;
      let without_spaces_count = 0;
      for (let index of range(0, text.length)) {
        let char = text[index];
        if (char === " " || char === "\t" || char === "\n") {
          continue;
        }
        without_spaces_count += 1;

        if (without_spaces_count > 20) {
          character_to_show_in_front = index;
          break;
        }
      }

      let character_to_show_in_the_back = 0;
      let without_spaces_count2 = 0;
      for (let index of range(text.length, 0)) {
        let char = text[index];
        if (char === " " || char === "\t" || char === "\n") {
          continue;
        }
        without_spaces_count2 += 1;

        if (without_spaces_count2 > 20) {
          character_to_show_in_the_back = text.length - index;
          break;
        }
      }

      if (
        from + character_to_show_in_front <
        to - character_to_show_in_the_back
      ) {
        decorations.push(
          Decoration.replace({
            widget: new ReactWidget(<FoldedRegion to={to} from={from} />),
          }).range(
            from + character_to_show_in_front,
            to - character_to_show_in_the_back
          )
        );
      }
    }
    return Decoration.set(decorations);
  }),
  EditorView.decorations.compute([what_to_fold], (state) => {
    let folds = state.field(what_to_fold);
    let decorations = /** @type {Array<Range<Decoration>>} */ ([]);

    let did_fold = /** @type {Array<[from: number, to: number]>} */ ([]);
    for (let [from, to] of folds) {
      if (did_fold.some(([f, t]) => f <= from && to <= t)) {
        continue;
      }
      did_fold.push([from, to]);

      let text = state.doc.sliceString(from, to);
      for (let { index, 0: match, 1: pre, 2: post } of text.matchAll(
        /(\()?\s+(\))?/g
      )) {
        index = /** @type {number} */ (index);
        let match_from = from + index + (pre?.length ?? 0);
        let match_to = from + index + match.length - (post?.length ?? 0);

        if (
          pre != null ||
          post != null ||
          index === 0 ||
          index + match.length === text.length
        ) {
          // If the match starts with "(" or /^/, or ends with ")" or /$/,
          // then we get rid of all the spaces
          decorations.push(Decoration.replace({}).range(match_from, match_to));
        } else {
          // If it is just whitespace in the middle, we preserve one space
          decorations.push(
            Decoration.replace({
              widget: new ReactWidget(<span> </span>),
            }).range(match_from, match_to)
          );
        }
      }
    }
    return Decoration.set(decorations);
  }),
  EditorView.decorations.compute([AllFoldsFacet], (state) => {
    // I wanted this to work with the foldNodeProps, but I find that complex and blablabla
    // so imma try without it 😁
    let all_folds = state.facet(AllFoldsFacet);
    return Decoration.set(
      all_folds.map((fold) =>
        Decoration.mark({
          attributes: {
            style: "cursor: pointer",
            "data-from": String(fold.fold_from),
            "data-to": String(fold.fold_to),
            class: "fold-me-daddy",
          },
        }).range(fold.from, fold.to)
      )
    );
  }),
  EditorView.domEventHandlers({
    click: (event, view) => {
      if (!(event.target instanceof HTMLElement)) return;

      let parent = event.target.closest(".fold-me-daddy");
      if (parent == null) return;

      let from = parent.getAttribute("data-from");
      let to = parent.getAttribute("data-to");
      if (from == null && to == null) return;
      let from_num = Number(from);
      let to_num = Number(to);
      if (
        view.state
          .field(what_to_fold)
          .some(([from, to]) => from === from_num && to === to_num)
      ) {
        view.dispatch({
          effects: [UnfoldEffect.of({ from: from_num, to: to_num })],
        });
      } else {
        view.dispatch({
          effects: [FoldEffect.of({ from: from_num, to: to_num })],
        });
      }
    },
  }),
  lezer_result_syntax_classes,
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.string, class: "literal" },
      { tag: t.variableName, class: "variable" },
      { tag: t.punctuation, class: "boring" },
    ])
  ),
];

let but_disable_all_editting = EditorState.transactionFilter.of((tr) => {
  if (tr.docChanged) {
    return [];
  }
  return tr;
});

/**
 * @param {{
 *  code_to_parse: string,
 *  parser: import("@lezer/lr").LRParser,
 * }} props
 */
export let ParsedResultEditor = ({ code_to_parse, parser }) => {
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
      <Extension extension={debug_syntax_plugin} />
      <Extension extension={lezer_result_syntax_classes} />
      <Extension extension={javascript_syntax_highlighting} />
      <Extension extension={lezer_as_javascript_plugins} />
      {/* <Extension extension={EditorView.editable.of(false)} deps={[]} /> */}
      <Extension extension={but_disable_all_editting} />
    </CodeMirror>
  );
};

/**
 * TODO Bind run_cell_code not to code,
 * .... but a mystical "parsed cell" type that comes
 * .... from transform-javascript?
 *
 * @param {string} code
 * @param {{ [argument: string]: any }} globals
 * @return {Promise<{
 *  export: { [key: string]: any },
 * }>}
 */
let run_cell_code = async (code, globals) => {
  let f = new Function(...Object.keys(globals), code);
  return await f(...Object.values(globals));
};

let GeneralEditorStyles = styled.div`
  height: 100%;
  font-family: Menlo, "Roboto Mono", "Lucida Sans Typewriter", "Source Code Pro",
    monospace;

  & .cm-scroller {
    /* padding-left: 16px; */
  }
  & .cm-content {
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    padding-right: 16px;
  }

  & .cm-panels {
    filter: invert(1);
  }
`;

let NOISE_BACKGROUND = new URL(
  "./noise-backgrounds/asfalt-light.png",
  import.meta.url
).href;
let PaneStyle = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 4px;

  .cm-content,
  .cm-gutters {
    background-size: 50px 50px;
    background-image: url("${NOISE_BACKGROUND}");

    &.cm-gutters {
      background-position: right;
    }
  }
`;

let PaneHeader = styled.div`
  padding-top: 3px;
  padding-bottom: 4px;
  padding-left: 18px;
  padding-right: 18px;
  font-weight: bold;
  font-size: 12px;

  background-color: #ffffff17;
  color: #ffffff75;

  display: flex;
  flex-direction: row;
  align-items: center;
`;

let Pane = ({ children, header, ...props }) => {
  return (
    <PaneStyle {...props}>
      <PaneHeader>{header}</PaneHeader>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </PaneStyle>
  );
};

// prettier-ignore
let AppGrid = styled.div`
  width: 100vw;
  height: 100vh;
  border: solid 8px black;
  background-color: black;

  display: grid;
  grid-template: 
    "what-to-parse-editor  ↑       parsed-result " minmax(0, 1fr)
    " ←                    █                  →  " 8px
    "lezer-editor          ↓   javascript-stuff  " minmax(0, 1fr)
    / 1fr 8px 1fr;
`;

// Thanks, https://loading.io/css/
let LoadingRingThing = styled.div`
  --size: 1em;
  --px: calc(var(--size) / 80);

  & {
    display: inline-block;
    position: relative;
    width: calc(80 * var(--px));
    height: calc(80 * var(--px));
  }
  &:after {
    content: " ";
    display: block;
    border-radius: 50%;
    width: 0;
    height: 0;
    margin: calc(8 * var(--px));
    box-sizing: border-box;
    border: calc(32 * var(--px)) solid currentColor;
    border-color: currentColor transparent currentColor transparent;
    animation: lds-hourglass 1.2s infinite;
  }
  @keyframes lds-hourglass {
    0% {
      transform: rotate(0);
      animation-timing-function: cubic-bezier(0.55, 0.055, 0.675, 0.19);
    }
    50% {
      transform: rotate(900deg);
      animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
    }
    100% {
      transform: rotate(1800deg);
    }
  }
`;

/**
 * @param {{
 *  title: string,
 *  process?: null | ExecutionResult<any> | Array<ExecutionResult<any>>,
 * }} props
 */
let PaneTab = ({ title, process }) => {
  let ERROR_COLOR = "rgb(133 0 0)";
  let processes =
    process == null ? [] : Array.isArray(process) ? process : [process];
  let errors = processes.filter((p) => p instanceof Failure);
  let loading = processes.find((p) => p instanceof Loading);

  return (
    <>
      <span style={{ color: errors.length !== 0 ? ERROR_COLOR : undefined }}>
        {title}
      </span>
      {loading != null && (
        <>
          <div style={{ minWidth: 8 }} />
          <LoadingRingThing />
        </>
      )}
      {/* Now slicing the first, gotta make sure I show all the errors but not too much though */}
      {errors.slice(0, 1).map((error) => (
        <>
          <div style={{ minWidth: 8 }} />
          <IonIcon icon={bonfire} style={{ color: ERROR_COLOR }} />
        </>
      ))}
    </>
  );
};

export let App = () => {
  const [path, setPath] = usePath();

  return <Editor project_name={path.path} />;
};

class TermsFileNotReadyError extends Error {
  constructor() {
    super("Terms file not ready");
  }
}

/**
 * @param {string[]} imported
 * @param {any} mod
 */
let verify_imported = (imported, mod) => {
  let invalid_imports = imported.filter((i) => !(i in mod));
  if (invalid_imports.length > 0) {
    throw new TypeError(`Module does not export ${invalid_imports.join(", ")}`);
  }
  return mod;
};

/** @param {{ project_name: string }} props */
let Editor = ({ project_name }) => {
  let main_scope = new ScopedStorage("lezer-playground").child(project_name);

  let [parser_code, set_parser_code] = useScopedStorage(
    main_scope.child("parser_code"),
    DEFAULT_PARSER_CODE
  );
  let [code_to_parse, set_code_to_parse] = useScopedStorage(
    main_scope.child("javascript_stuff"),
    DEFAULT_TO_PARSE
  );
  let [javascript_stuff, set_javascript_stuff] = useScopedStorage(
    main_scope.child("code_to_parse"),
    DEFAULT_JAVASCRIPT_STUFF
  );
  let lezer_on_change = React.useCallback(
    (str) => set_parser_code(str),
    [set_parser_code]
  );
  let code_to_parse_on_change = React.useCallback(
    (str) => set_code_to_parse(str),
    [set_code_to_parse]
  );
  let javascript_stuff_on_change = React.useCallback(
    (str) => set_javascript_stuff(str),
    [set_javascript_stuff]
  );

  let babel_worker = useWorker(() => new TransformJavascriptWorker(), []);
  let get_lezer_worker = useWorkerPool(() => new LezerGeneratorWorker());

  let generated_parser_code = usePromise(
    async (signal) => {
      // Build the parser file first
      return await get_lezer_worker(signal).request("build-parser", {
        code: parser_code,
      });
    },
    [parser_code, get_lezer_worker]
  );

  let terms_file_result = usePromise(
    async (signal) => {
      if (babel_worker == null) {
        throw Loading.of();
      }
      if (generated_parser_code instanceof Failure) {
        throw new Error("Failed to parser.terms.js");
      }

      let { terms: terms_code_raw, parser: parser_code_raw } =
        generated_parser_code.get();

      let terms_code = await babel_worker.request("transform-code", {
        code: terms_code_raw,
      });

      // Run the terms file
      return await run_cell_code(terms_code.code, {});
    },
    [generated_parser_code, babel_worker]
  );

  let javascript_result = usePromise(
    async (signal) => {
      if (babel_worker == null) {
        throw Loading.of();
      }

      // Run the javascript file,
      // with the terms file as a possible import
      let our_javascript_code = await babel_worker.request("transform-code", {
        code: javascript_stuff,
      });
      let import_map = {
        "@lezer/highlight": () => import("@lezer/highlight"),
        "@codemirror/language": () => import("@codemirror/language"),
        "@codemirror/view": () => import("@codemirror/view"),
        "@codemirror/state": () => import("@codemirror/state"),
        "style-mod": () => import("style-mod"),
        "@lezer/lr": () => import("@lezer/lr"),
        "./parser.terms.js": async () => {
          if (terms_file_result instanceof Failure) {
            // prettier-ignore
            throw new TypeError(`Failed to resolve module specifier './parser.terms.js'`);
          }
          if (terms_file_result instanceof Loading) {
            throw new TermsFileNotReadyError();
          }
          return terms_file_result.get();
        },
      };

      try {
        let untyped_result = await run_cell_code(our_javascript_code.code, {
          __meta__: {
            // prettier-ignore
            url: new URL("./lezer-playground.js", window.location.href).toString(),
            import: async (specifier, imported) => {
              let fn = import_map[specifier];
              if (fn == null)
                return verify_imported(
                  imported,
                  await import(/* @vite-ignore */ specifier)
                );
              return verify_imported(imported, await fn());
            },
          },
        });
        return /** @type {{ export: { extensions: Array<import("@codemirror/state").Extension> } }} */ (
          untyped_result
        );
      } catch (error) {
        if (error instanceof TermsFileNotReadyError) {
          throw Loading.of();
        } else {
          throw error;
        }
      }
    },
    [terms_file_result, babel_worker, javascript_stuff, terms_file_result]
  );

  let parser = usePromise(async () => {
    if (babel_worker == null) {
      throw Loading.of();
    }
    if (generated_parser_code instanceof Failure) {
      throw new Error("Failed to generate parser");
    }

    let parser_code_raw = generated_parser_code.get().parser;

    let code_i_can_run = await babel_worker.request("transform-code", {
      code: parser_code_raw,
    });
    let parser_result = await run_cell_code(code_i_can_run.code, {
      __meta__: {
        url: new URL("./lezer/parser.js", window.location.href).toString(),
        import: (specifier, requested) => {
          if (specifier === "@lezer/lr") {
            return {
              LRParser: { deserialize: (x) => x },
            };
          } else {
            if (javascript_result instanceof Failure) {
              // prettier-ignore
              throw new Error(`You are trying to import "${specifier}", but the javascript failed to run.`);
            } else if (javascript_result instanceof Loading) {
              // TODO Specific error?
              throw new Error("Loading javascript");
            }
            let exported_from_js = javascript_result.get().export;
            for (let request of requested) {
              if (exported_from_js[request] == null) {
                throw new Error(`Variable "${request}" not exported from "${specifier}".
"${specifier}" is referenced in your lezer grammar, and in this playground that means it is imported from the "javascript stuff" file.`);
              }
            }
            return exported_from_js;
          }
        },
      },
    });

    return LRParser.deserialize(parser_result.export.parser);
  }, [generated_parser_code, babel_worker, javascript_result]);

  let js_stuff = React.useMemo(
    () => javascript_result.map((x) => x.export),
    [javascript_result]
  );

  let parser_in_betweens = useMemoizeSuccess(parser);

  return (
    <AppGrid>
      <Pane
        style={{ gridArea: "lezer-editor", backgroundColor: "#010539" }}
        header={
          <PaneTab
            title="lezer grammar"
            process={[generated_parser_code, parser]}
          />
        }
      >
        <GeneralEditorStyles>
          <LezerEditor
            error={
              generated_parser_code instanceof Failure
                ? generated_parser_code.value
                : null
            }
            doc={parser_code}
            onChange={lezer_on_change}
            result={parser}
          />
        </GeneralEditorStyles>
      </Pane>

      <Pane
        style={{ gridArea: "what-to-parse-editor", backgroundColor: "#0a0a0a" }}
        header={
          <>
            <span>demo text</span>
            <div style={{ minWidth: 8 }} />
            {/* <LoadingRingThing /> */}
          </>
        }
      >
        <GeneralEditorStyles>
          <WhatToParseEditorWithErrorBoundary
            doc={code_to_parse}
            onChange={code_to_parse_on_change}
            errors={compact([
              generated_parser_code instanceof Failure
                ? {
                    title: "Lezer grammar error",
                    error: generated_parser_code.value,
                  }
                : null,
              js_stuff instanceof Failure
                ? { title: "Javascript error", error: js_stuff.value }
                : null,

              parser instanceof Failure
                ? { title: "Parser generation error", error: parser.value }
                : null,
            ])}
            js_stuff={js_stuff}
            parser={
              parser_in_betweens instanceof Success
                ? parser_in_betweens.get()
                : null
            }
          />
        </GeneralEditorStyles>
      </Pane>

      <Pane
        style={{ gridArea: "parsed-result", backgroundColor: "#001107" }}
        header={
          <>
            <span>lezer result tree</span>
            <div style={{ minWidth: 8 }} />
            {/* <LoadingRingThing /> */}
          </>
        }
      >
        <GeneralEditorStyles>
          {parser_in_betweens instanceof Success ? (
            <ParsedResultEditor
              parser={parser_in_betweens.value}
              code_to_parse={code_to_parse}
            />
          ) : parser_in_betweens instanceof Failure ? (
            <pre style={{ color: "red", whiteSpace: "pre-wrap", padding: 8 }}>
              {parser_in_betweens.value.toString()}
            </pre>
          ) : (
            <pre style={{ color: "yellow", padding: 8 }}>Loading</pre>
          )}
        </GeneralEditorStyles>
      </Pane>

      <Pane
        style={{ gridArea: "javascript-stuff" }}
        header={<PaneTab title="javascript stuff" process={js_stuff} />}
      >
        <GeneralEditorStyles>
          <JavascriptStuffEditor
            error={
              javascript_result instanceof Failure
                ? javascript_result.value
                : null
            }
            doc={javascript_stuff}
            onChange={javascript_stuff_on_change}
          />
        </GeneralEditorStyles>
      </Pane>

      {["↓", "→", "↑", "←", "█"].map((area) => (
        <div
          key={area}
          style={{
            gridArea: area,
            backgroundColor: "black",
          }}
        />
      ))}
    </AppGrid>
  );
};
