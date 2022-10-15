import React from "react";
import styled from "styled-components";
import { CodeMirror, Extension } from "codemirror-x-react";
import { lezerLanguage } from "@codemirror/lang-lezer";

import { EditorState, Prec } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  gutter,
  GutterMarker,
  keymap,
  placeholder,
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

import { format_with_prettier } from "../../format-javascript-with-prettier.js";
import {
  basic_javascript_setup,
  javascript_syntax_highlighting,
} from "../../codemirror-javascript-setup.js";
import { DecorationsFromTree } from "../../basic-markdown-setup.jsx";

import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import { DEFAULT_TO_PARSE } from "./default-to-parse.js";
import { BabelWorker } from "../../packages/babel-worker/babel-worker.js";

import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";

import "../../App.css";
import { LezerGeneratorWorker } from "../../packages/lezer-generator-worker/lezer-generator-worker.js";
import { IonIcon } from "@ionic/react";
import { bonfire, bonfireOutline } from "ionicons/icons";
import usePath from "react-use-path";

import "./App.css";

let lezerStyleTags = styleTags({
  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  AnyChar: t.character,
  Literal: t.string,
  "tokens from grammar as empty prop extend specialize": t.keyword,
  "@top @left @right @cut @external": t.modifier,
  "@precedence @tokens @context @dialects @skip @detectDelim @conflict":
    t.definitionKeyword,
  "@extend @specialize": t.operatorKeyword,
  "CharSet InvertedCharSet": t.regexp,
  CharClass: t.atom,
  RuleName: t.variableName,
  "RuleDeclaration/RuleName InlineRule/RuleName TokensBody/RuleName":
    t.definition(t.variableName),
  PrecedenceName: t.labelName,
  Name: t.name,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  '"!" ~ "*" + ? |': t.operator,
  "=": t.punctuation,

  "Call/RuleName": t.function(t.variableName),
  "PrecedenceMarker!": t.className,
  "Prop/AtName": t.propertyName,
  propSource: t.keyword,
});

let lezer_syntax_classes = EditorView.theme({
  ".very-important": {
    color: "#947eff",
    fontWeight: 700,
  },
  ".important": {
    color: "#947eff",
  },
  ".boring": {
    color: "#6a3e7d",
  },

  ".property": {
    color: "#cb00d7",
  },
  ".variable": {
    color: "#7229ff",
  },
  ".literal": {
    color: "#00a7ca",
  },
  ".comment": {
    color: "#747474",
    fontStyle: "italic",
  },
});

let lezer_result_syntax_classes = EditorView.theme({
  ".very-important": {
    color: "#ffb4fb",
    fontWeight: 700,
  },
  ".important": {
    color: "#ffb4fb",
  },
  ".boring": {
    color: "#2c402d",
  },

  ".property": {
    color: "#cb00d7",
  },
  ".variable": {
    color: "#0d6801",
  },
  ".literal": {
    color: "#00c66d",
  },
  ".comment": {
    color: "#747474",
    fontStyle: "italic",
  },
});

let lezer_extension = new LanguageSupport(
  lezerLanguage.configure({
    props: [lezerStyleTags],
  })
);
let lezer_highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.lineComment, class: "comment" },
    { tag: t.blockComment, class: "comment" },
    { tag: t.character, class: "literal" },
    { tag: t.string, class: "literal" },
    { tag: t.keyword, class: "important" },
    { tag: t.modifier, class: "green" },
    { tag: t.definitionKeyword, class: "very-important" },
    { tag: t.operatorKeyword, class: "important" },
    { tag: t.regexp, class: "literal" },
    { tag: t.atom, class: "literal" },
    { tag: t.variableName, class: "variable" },
    { tag: t.definition(t.variableName), class: "variable" },
    { tag: t.name, class: "variable" },
    { tag: t.paren, class: "boring" },
    { tag: t.squareBracket, class: "boring" },
    { tag: t.brace, class: "boring" },
    { tag: t.operator, class: "very-important" },

    { tag: t.labelName, class: "property" },
    { tag: t.function(t.variableName), class: "variable" },

    { tag: t.propertyName, class: "property" },
    { tag: t.className, class: "property" },
    { tag: t.modifier, class: "very-important" },
    { tag: t.punctuation, class: "boring" },
  ])
);

let subtle_gutter = EditorView.theme({
  ".cm-gutters": {
    "background-color": "transparent",
    "border-right": "none",
  },
});

class DotGutter extends GutterMarker {
  constructor(/** @type {number} */ line) {
    super();
  }
  eq() {
    return true;
  }
  toDOM() {
    let dom = document.createElement("div");
    dom.className = "dot-gutter";
    return dom;
  }
}

let dot_gutter = [
  EditorView.theme({
    ".cm-gutters": {
      "background-color": "transparent",
      "border-right": "none",
    },
    ".dot-gutter": {
      "margin-top": "10px",
      width: "5px",
      height: "5px",
      "margin-left": "6px",
      "margin-right": "6px",
      "background-color": "#ffffff17",
      "border-radius": "3px",
    },
  }),
  gutter({
    lineMarker: () => new DotGutter(),
  }),
];

let base_extensions = [
  subtle_gutter,
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
      <Extension extension={lezer_extension} />
      <Extension extension={on_change_extension} />
      <Extension extension={lezer_syntax_classes} />
      <Extension extension={lezer_highlight} />
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
      console.log(`language:`, language);
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

/** @param {import("lezer-template").TreeCursor} cursor */
let cursor_to_js = (cursor) => {
  let code = "";
  if (cursor.type.isError) {
    code += `new Error`;
  } else if (cursor.type.isAnonymous) {
    code += `"${cursor.name}"`;
  } else {
    if (/^[A-Z_$][a-zA-Z_$0-9]*$/.test(cursor.name)) {
      code += cursor.name;
    } else {
      code += `"${cursor.name}"`;
    }
  }

  if (cursor.firstChild()) {
    code += "(";
    try {
      do {
        code += cursor_to_js(cursor) + ", ";
      } while (cursor.nextSibling());
    } finally {
      cursor.parent();
    }
    code += `)`;
  }

  return code;
};

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

let lezer_as_javascript_plugins = [
  new LanguageSupport(
    javascriptLanguage.configure({
      props: [
        foldNodeProp.add({
          ArgList: foldInside,
        }),
      ],
    })
  ),
  codeFolding(),
  foldGutter({}),
  lezer_result_syntax_classes,
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.special(t.typeName), opacity: 0.7 },

      { tag: t.string, class: "literal" },
      { tag: t.bool, class: "literal", fontWeight: 700 },
      { tag: t.number, class: "literal" },
      { tag: t.literal, class: "literal", fontWeight: 700 },
      { tag: t.null, class: "literal" },

      { tag: t.keyword, class: "boring" },

      { tag: t.variableName, class: "variable" },
      { tag: t.className, class: "variable" },
      { tag: t.propertyName, class: "property" },
      { tag: t.comment, class: "comment" },

      { tag: t.special(t.brace), fontWeight: 700 },

      // super
      { tag: t.atom, class: "important" },
      // this
      { tag: t.self, class: "important" },

      // { tag: t.property, color: "#48b685" },
      // { tag: t.attribute, color: "#48b685" },
      // { tag: t.variable2, color: "#06b6ef" },
      {
        tag: t.typeName,
        color: "var(--cm-type-color)",
        fontStyle: "italic",
      },

      // ,
      { tag: t.punctuation, class: "boring" },

      // =
      { tag: t.definitionOperator, class: "very-important" },
      // =>
      { tag: t.function(t.punctuation), class: "very-important" },
      // += -= *= /= ??=
      { tag: t.updateOperator, class: "important" },

      { tag: t.bracket, class: "boring" },
      { tag: t.brace, class: "boring" },

      // Catch all for operators
      { tag: t.operator, class: "important" },
      // .
      { tag: t.derefOperator, class: "boring" },
      // + - * /
      { tag: t.arithmeticOperator, class: "important" },
      // === !==
      { tag: t.compareOperator, class: "important" },
      // && ||
      { tag: t.logicOperator, class: "important" },
      // TODO Maybe make `!` even more emphasized? Make sure it is hard to miss
      // !
      { tag: t.special(t.logicOperator), class: "very-important" },
      // export import
      { tag: t.moduleKeyword, class: "important" },
      // if else while break continue
      { tag: t.controlKeyword, class: "very-important" },
      // ? :
      { tag: t.controlOperator, class: "very-important" },

      // JSX
      { tag: t.content, class: "literal" },
      { tag: t.attributeValue, class: "literal" },
      { tag: t.angleBracket, class: "boring" },
      { tag: t.attributeName, class: "property" },
      { tag: t.special(t.tagName), class: "variable" },

      // Ideally t.standard(t.tagName) would work, but it doesn't....
      // Still putting it here just for kicks, but lezer doesn't differentiate between builtin t and Component names...
      { tag: t.standard(t.tagName), class: "literal" },
      // So instead I handle this manually with decorations in `lowercase_jsx_identifiers`,
      // and I "clear" `t.tagName` here so that it doesn't get styled as a variable
      { tag: t.tagName, class: "" },
      // But I do need the variables inside `JSXMemberExpression` to get styled so...
      { tag: t.special(t.tagName), class: "variable" },
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
  let parsed = React.useMemo(() => {
    console.log(`parser.parse:`, parser.parse);
    try {
      return Success.of(parser.parse(code_to_parse));
    } catch (error) {
      return Failure.of(error);
    }
  }, [parser, code_to_parse]);

  let parsed_as_json = React.useMemo(() => {
    return parsed.map((tree) => {
      let str = cursor_to_js(tree.cursor());
      try {
        return format_with_prettier({
          code: str,
          cursor: 0,
        }).formatted;
      } catch (error) {
        console.log(`error:`, error);
        return str;
      }
    });
  }, [parsed]).or(code_to_parse);

  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc: parsed_as_json,
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
        insert: parsed_as_json,
      },
    });
  }, [parsed_as_json]);

  return (
    <CodeMirror ref={codemirror_ref} state={initial_editor_state}>
      <Extension extension={Decorate_New_Error} />
      <Extension extension={debug_syntax_plugin} />
      <Extension extension={lezer_result_syntax_classes} />
      <Extension extension={javascript_syntax_highlighting} />
    </CodeMirror>
  );
};

let DEFAULT_PARSER_CODE = `
@top Program { node }

Fatal { "⚠" argument_list? }
argument_list { "(" node ("," node)* ")" }
node { Fatal | Node | String }
Node { Name argument_list? }

@skip { spaces | newline }

@tokens {
  Name { @asciiLetter+ }
  String { '"' (![\\\\\\n"] | "\\\\" _)* '"' }
  newline { $[\\r\\n] }
  spaces { " "+ }
}
`.trim();

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

/**
 * @template T
 * @typedef ExecutionResult
 * @type {Success<T> | Failure<T> | Loading<T>}
 */

/**
 * @template T
 */
class Success {
  constructor(/** @type {T} */ value) {
    this.value = value;
  }
  /**
   * @template R
   * @param {(value: T) => R} f
   * @returns {ExecutionResult<R>}
   */
  map(f) {
    try {
      return new Success(f(this.value));
    } catch (error) {
      if (error instanceof Failure) {
        return new Failure();
      } else if (error instanceof Loading) {
        return new Loading();
      } else {
        return new Failure(error);
      }
    }
  }
  /**
   * @returns {T}
   */
  get() {
    return this.value;
  }

  /**
   * @template T
   * @param {T} value
   */
  or(value) {
    return this.value;
  }
  /** @template T */
  static of(/** @type {T} */ value) {
    return new Success(value);
  }
}
/**
 * @template T
 */
class Failure {
  constructor(value) {
    this.value = value;
  }
  /**
   * @template R
   * @param {R} value
   */
  or(value) {
    return value;
  }
  /**
   * @returns {never}
   */
  get() {
    throw this.value;
  }
  /**
   * @template R
   * @param {(value: T) => R} f
   * @returns {Failure<R>}
   */
  map(f) {
    return new Failure(this.value);
  }
  static of(value) {
    return new Failure(value);
  }
}
/**
 * @template T
 */
class Loading {
  /**
   * @param {Promise<T>} [promise]
   */
  constructor(promise) {
    this.promise = promise;
  }
  /**
   * @template R
   * @param {(value: T) => R} f
   * @returns {Loading<R>}
   */
  map(f) {
    return new Loading(this.promise?.then(f));
  }
  /**
   * @template R
   * @param {R} value
   */
  or(value) {
    return value;
  }
  /**
   * @returns {never}
   */
  get() {
    throw this;
  }
  static of() {
    return new Loading();
  }
}

let DEFAULT_JAVASCRIPT_STUFF = `
import { styleTags, tags as t } from "@lezer/highlight";

export let tags = styleTags({
  Fatal: t.attributeName,
  String: t.string,
});
`.trim();

/**
 * @template T
 * @param {ExecutionResult<T>} execution
 */
let flattenExecution = (execution) => {
  if (execution instanceof Success) {
    if (execution.value instanceof Success) {
      return flattenExecution(execution.value);
    } else if (execution.value instanceof Failure) {
      return execution.value;
    } else if (execution.value instanceof Loading) {
      return execution.value;
    }
  } else {
    return execution;
  }
};

/**
 * @template T
 * @param {(abort_signal: AbortSignal) => Promise<T>} fn
 * @param {any[]} deps
 * @returns {ExecutionResult<T>}
 */
let usePromise = (fn, deps) => {
  let [value, set_value] = React.useState(
    /** @type {ExecutionResult<T>} */ (Loading.of())
  );

  React.useEffect(() => {
    let cancelled = false;
    let abort_controller = new AbortController();

    set_value(Loading.of());
    Promise.resolve().then(async () => {
      try {
        let value = await fn(abort_controller.signal);
        if (cancelled) return;

        if (value instanceof Loading) {
          // Already loading yeh
        }
        set_value(value instanceof Failure ? value : Success.of(value));
      } catch (error) {
        if (cancelled) return;

        if (error instanceof Failure) {
          set_value(error);
        } else if (error instanceof Loading) {
          // No set needed, because we're already loading
        } else {
          set_value(Failure.of(error));
        }
      } finally {
        abort_controller.abort();
      }
    });

    return () => {
      cancelled = true;
      abort_controller.abort();
    };
  }, deps);

  return value;
};

class ScopedStorage {
  constructor(/** @type {string} */ key) {
    this.key = key;
  }
  get() {
    try {
      let string_value = localStorage.getItem(this.key);
      if (string_value == null) {
        return string_value;
      } else {
        return JSON.parse(string_value);
      }
    } catch (error) {
      return null;
    }
  }

  set(value) {
    localStorage.setItem(this.key, JSON.stringify(value));
  }

  child(/** @type {string} */ key) {
    return new ScopedStorage(`${this.key}.${key}`);
  }
}

let useScopedStorage = (
  /** @type {ScopedStorage} */ storage,
  default_value
) => {
  // TODO I totally assume `storage` doesn't change and I'm okay with that

  let initial_storage = React.useMemo(() => {
    return storage.get();
  }, []);
  let [value, set_value] = React.useState(initial_storage ?? default_value);

  let set_value_and_store = React.useCallback(
    (value) => {
      set_value(value);
      storage.set(value);
    },
    [set_value]
  );

  return [value, set_value_and_store];
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

/**
 * @template {Worker} T
 * @param {() => T} create_worker
 * @param {any[]} deps
 * @returns {T | null}
 */
let useWorker = (create_worker, deps) => {
  let [worker, set_worker] = React.useState(
    /** @type {T} */ (/** @type {any} */ (null))
  );
  React.useEffect(() => {
    let worker = create_worker();

    set_worker(worker);

    return () => {
      worker.terminate();
    };
  }, deps);
  return worker;
};

/**
 * @template {Worker} T
 * @param {() => T} create_worker
 * @param {any[]} deps
 * @returns {(signal: AbortSignal) => T}
 */
let useWorkerPool = (create_worker, deps) => {
  let workers_ref = React.useRef(new Set());

  React.useEffect(() => {
    return () => {
      for (let worker of workers_ref.current) {
        worker.terminate();
      }
    };
  }, []);

  let get_worker = React.useCallback(
    (/** @type {AbortSignal} */ abort_signal) => {
      let worker = create_worker();
      workers_ref.current.add(worker);

      abort_signal.addEventListener("abort", () => {
        worker.terminate();
        workers_ref.current.delete(worker);
      });

      return worker;
    },
    []
  );

  return get_worker;
};

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

/**
 * @template T
 * @param {ExecutionResult<T>} result
 */
let useMemoizeSuccess = (result) => {
  let value_ref = React.useRef(result);

  if (result instanceof Success || result instanceof Failure) {
    value_ref.current = result;
  }

  return value_ref.current;
};

export let App = () => {
  const [path, setPath] = usePath();

  return <Editor project_name={path.path} />;
};

/** @param {{ project_name: string }} props */
export let Editor = ({ project_name }) => {
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
  let get_lezer_worker = useWorkerPool(() => new LezerGeneratorWorker(), []);

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
          if (fn == null) return import(specifier);
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
