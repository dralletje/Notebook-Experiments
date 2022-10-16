import React from "react";
import styled from "styled-components";
import { CodeMirror, Extension } from "codemirror-x-react";
import { produce } from "immer";
import {
  EditorState,
  Facet,
  Prec,
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
  foldGutter,
  foldInside,
  foldNodeProp,
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

import {
  basic_javascript_setup,
  javascript_syntax_highlighting,
} from "../../codemirror-javascript-setup.js";
import { DecorationsFromTree } from "../../basic-markdown-setup.jsx";

import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import {
  DEFAULT_JAVASCRIPT_STUFF,
  DEFAULT_PARSER_CODE,
  DEFAULT_TO_PARSE,
} from "./default-field-codes.js";
import { BabelWorker } from "../../packages/babel-worker/babel-worker.js";

import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";

import "../../App.css";
import { LezerGeneratorWorker } from "../../packages/lezer-generator-worker/lezer-generator-worker.js";
import { IonIcon } from "@ionic/react";
import { bonfire, bonfireOutline } from "ionicons/icons";
import usePath from "react-use-path";

import "./App.css";
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
import { lezer_syntax_extensions } from "./editors/lezer-editor.js";
import { ReactWidget, useEditorView } from "react-codemirror-widget";

/**
 * @template T
 * @typedef ExecutionResult
 * @type {import("./use/OperationMonadBullshit.js").ExecutionResult<T>}
 */

let base_extensions = [
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

/** @param {{ doc: string, onChange: (str: string) => void, result: ExecutionResult<any> }} props */
export let LezerEditor = ({ doc, onChange, result }) => {
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
    if (result instanceof Failure) {
      let position = position_from_error(result.value);
      if (position) {
        let { line, column } = position;
        return EditorView.decorations.of((view) => {
          let line_start = view.state.doc.line(line).from;
          return Decoration.set(
            Decoration.mark({
              class: "programming-error-oops",
            }).range(line_start + column, line_start + column + 1)
          );
        });
      }
    }
    return [];
  }, [result]);

  return (
    <CodeMirror state={initial_editor_state}>
      <Extension extension={lezer_syntax_extensions} />
      <Extension extension={on_change_extension} />
      <Extension extension={awesome_line_wrapping} />
      <Extension extension={error_extension} />
    </CodeMirror>
  );
};

/** @param {{ doc: string, onChange: (str: string) => void }} props */
export let JavascriptStuffEditor = ({ doc, onChange }) => {
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

  return (
    <CodeMirror state={initial_editor_state}>
      <Extension extension={on_change_extension} />
      <Extension extension={basic_javascript_setup} />
    </CodeMirror>
  );
};

/**
 * @param {{
 *  doc: string,
 *  onChange: (str: string) => void,
 *  parser: import("@lezer/lr").LRParser | null,
 *  js_stuff: ExecutionResult<{
 *    tags: import("@lezer/common").NodePropSource,
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
      return new LanguageSupport(
        language.configure({
          props: js_result?.tags == null ? [] : [js_result?.tags],
        })
      );
    } else {
      return EditorView.updateListener.of(() => {});
    }
  }, [parser, js_result?.tags]);

  let on_change_extension = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });
  }, [onChange]);

  let custom_extensions = React.useMemo(() => {
    return js_result?.extensions ?? [];
  }, [js_result?.extensions]);

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
 * @extends {React.Component<Parameters<WhatToParseEditor>[0]>}
 */
class WhatToParseEditorWithErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.last_js_stuff = props.js_stuff;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    let { error } = this.state;
    let should_still_error =
      (error != null && this.last_js_stuff == this.props.js_stuff) ||
      this.props.js_stuff instanceof Failure;
    let js_stuff = should_still_error ? Failure.of(error) : this.props.js_stuff;

    if (!should_still_error) {
      this.last_js_stuff = this.props.js_stuff;
      if (error != null) {
        this.setState({ error: null });
      }
    }

    let error_to_show = should_still_error
      ? this.props.js_stuff instanceof Failure
        ? this.props.js_stuff.value
        : error
      : null;

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
          <WhatToParseEditor {...this.props} js_stuff={js_stuff} />
        </div>

        {error_to_show &&
          (this.props.js_stuff instanceof Failure ? (
            <ErrorBox>
              <h1>error running javascript</h1>
              {/* @ts-ignore */}
              <pre>{this.props.js_stuff.value.message}</pre>
            </ErrorBox>
          ) : (
            <ErrorBox>
              <h1>editor/extension crashed</h1>
              {/* @ts-ignore */}
              <pre>{error_to_show.message}</pre>
            </ErrorBox>
          ))}
      </div>
    );
  }
}

let Decorate_New_Error = Prec.highest(
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "NewExpression") {
      mutable_decorations.push(
        Decoration.mark({ attributes: { style: "color: red" } }).range(
          cursor.from,
          cursor.to
        )
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
    color: "#0d6801",
    opacity: "0.7",
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
import { range } from "lodash";
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
    console.log("AAAA");
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
    for (let effect of tr.effects) {
      if (effect.is(OpenPositionEffect)) {
        if (effect.value == null) {
          return null;
        }

        let positions = tree_position_to_cursor(
          syntaxTree(tr.state).cursor(),
          effect.value
        );
        return positions;
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
    if (update.startState.field(what_to_focus) !== plllt && plllt !== null) {
      console.log(`plllt:`, plllt);
      let x = plllt.at(-1)?.[0];
      if (x != null) {
        update.view.dispatch({
          effects: [
            EditorView.scrollIntoView(x, { y: "center", x: "nearest" }),
          ],
        });
      }
    }
  }),
];
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////

/** @type {StateEffectType<{ from: number, to: number }>} */
let FoldEffect = StateEffect.define();
/** @type {StateEffectType<{ from: number, to: number }>} */
let UnfoldEffect = StateEffect.define();
let what_to_fold = StateField.define({
  create() {
    return /** @type {Array<[from: number, to: number]>} */ ([]);
  },
  update(value, tr) {
    if (tr.docChanged) {
      return [];
    }
    let focusmehhh = tr.state.field(what_to_focus);
    if (
      focusmehhh !== tr.startState.field(what_to_focus) &&
      focusmehhh != null
    ) {
      let folds = tr.state.facet(AllFoldsFacet);
      // @ts-ignore
      let [from, to] = focusmehhh.at(-1);
      let new_folds = folds
        .filter((x) => {
          return to < x.fold_from || x.fold_to < from;
        })
        .map((x) => [x.fold_from, x.fold_to]);
      return new_folds;
    }

    return produce(value, (value) => {
      for (let effect of tr.effects) {
        if (effect.is(FoldEffect)) {
          value.push([effect.value.from, effect.value.to]);
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
  let str = view.state.doc
    .sliceString(from, to)
    .trim()
    // @ts-ignore
    .replaceAll(/\([\s ]+/g, "(")
    .replaceAll(/[\s ]+\)/g, ")")
    .replaceAll(/[\s ]+/g, " ");

  return (
    <span
      className="folded"
      data-from={from}
      data-to={to}
      onClick={() => {
        view.dispatch({
          effects: UnfoldEffect.of({ from, to }),
        });
      }}
    >
      {str.length > 20 ? (
        <>
          {str.slice(0, 20)}
          <span className="ellipsis">{" … "}</span>
          {str.slice(-20)}
        </>
      ) : (
        str
      )}
    </span>
  );
};

let AllFoldsFacet = Facet.define({
  combine: (values) => values[0],
});

let lezer_as_javascript_plugins = [
  new LanguageSupport(
    javascriptLanguage.configure({
      props: [foldNodeProp.add({ ArgList: foldInside })],
    })
  ),
  codeFolding(),
  what_to_fold,
  fold_style,
  AllFoldsFacet.compute(["doc"], (state) => {
    let cursor = syntaxTree(state).cursor();
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
  all_this_just_to_click,
  EditorView.decorations.compute([what_to_fold], (state) => {
    let folds = state.field(what_to_fold);
    // TODO I could still preserve syntax highlighting?
    // .... https://codemirror.net/docs/ref/#language.highlightingFor
    return Decoration.set(
      folds.map(([from, to]) => {
        return Decoration.replace({
          widget: new ReactWidget(<FoldedRegion from={from} to={to} />),
        }).range(from, to);
      }),
      true
    );
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
      extensions: [
        base_extensions,
        EditorView.editable.of(false),
        lezer_as_javascript_plugins,
      ],
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
    });
  }, [parsed_as_js]);

  return (
    <CodeMirror ref={codemirror_ref} state={initial_editor_state}>
      <Extension extension={Decorate_New_Error} />
      <Extension extension={debug_syntax_plugin} />
      <Extension extension={lezer_result_syntax_classes} />
      <Extension extension={javascript_syntax_highlighting} />
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
 *  process?: ExecutionResult<any> | null,
 * }} props
 */
let PaneTab = ({ title, process = null }) => {
  let ERROR_COLOR = "rgb(133 0 0)";
  return (
    <>
      <span
        style={{ color: process instanceof Failure ? ERROR_COLOR : undefined }}
      >
        {title}
      </span>
      {process instanceof Loading && (
        <>
          <div style={{ minWidth: 8 }} />
          <LoadingRingThing />
        </>
      )}
      {process instanceof Failure && (
        <>
          <div style={{ minWidth: 8 }} />
          <IonIcon icon={bonfire} style={{ color: ERROR_COLOR }} />
        </>
      )}
    </>
  );
};

export let App = () => {
  const [path, setPath] = usePath();

  return <Editor project_name={path.path} />;
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

  let babel_worker = useWorker(() => new BabelWorker(), []);
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

  let result = usePromise(async () => {
    if (babel_worker == null) {
      throw Loading.of();
    }

    let { terms: terms_code_raw, parser: parser_code_raw } =
      generated_parser_code.get();

    let terms_code = await babel_worker.request("transform-code", {
      code: terms_code_raw,
    });

    // Run the terms file
    let terms = await run_cell_code(terms_code.code, {});

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
      "./parser.terms.js": () => terms.export,
    };
    let javascript_result = await run_cell_code(our_javascript_code.code, {
      styleTags,
      __meta__: {
        url: new URL("./lezer-playground.js", window.location.href).toString(),
        import: (specifier) => {
          let fn = import_map[specifier];
          if (fn == null) return import(/* @vite-ignore */ specifier);
          return fn();
        },
      },
    });

    /**
     * @type {{
     *  tags: import("@lezer/common").NodePropSource,
     *  extensions: import("@codemirror/state").Extension[],
     * }}
     */
    let exported_from_js = /** @type {any} */ (javascript_result.export);

    let code_i_can_run = await babel_worker.request("transform-code", {
      code: parser_code_raw,
    });

    console.log(`code_i_can_run:`, code_i_can_run);

    let parser_result = await run_cell_code(code_i_can_run.code, {
      styleTags,
      __meta__: {
        url: new URL("./lezer/parser.js", window.location.href).toString(),
        import: (specifier, requested) => {
          if (specifier === "@lezer/lr") {
            return {
              LRParser: { deserialize: (x) => x },
            };
          } else {
            for (let request of requested) {
              if (exported_from_js[request] == null) {
                throw new Error(
                  `Variable "${request}" not exported from "${specifier}"`
                );
              }
            }
            return exported_from_js;
          }
        },
      },
    });

    return {
      parser: LRParser.deserialize(parser_result.export.parser),
      js_stuff: exported_from_js,
    };
  }, [generated_parser_code, get_lezer_worker, javascript_stuff]);

  let parser = result.map((x) => x.parser);
  let js_stuff = result.map((x) => x.js_stuff);

  console.log(`js_stuff:`, js_stuff);

  let parser_in_betweens = useMemoizeSuccess(parser);

  return (
    <AppGrid>
      <Pane
        style={{ gridArea: "lezer-editor", backgroundColor: "rgb(0 6 80)" }}
        header={
          <PaneTab title="lezer grammar" process={generated_parser_code} />
        }
      >
        <GeneralEditorStyles>
          <LezerEditor
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
            js_stuff={js_stuff}
            parser={
              parser_in_betweens instanceof Success
                ? parser_in_betweens.value
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
