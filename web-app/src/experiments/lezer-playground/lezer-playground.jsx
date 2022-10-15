import React from "react";
import styled from "styled-components";
import { CodeMirror, Extension } from "codemirror-x-react";
import { lezer } from "@codemirror/lang-lezer";

import { buildParser } from "@dral/lezer-generator";
import { EditorState, Prec } from "@codemirror/state";
import { LRParser } from "@lezer/lr";
import {
  Decoration,
  drawSelection,
  EditorView,
  gutter,
  GutterMarker,
  keymap,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import {
  bracketMatching,
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

import { format_with_prettier } from "../../format-javascript-with-prettier.js";
import {
  basic_javascript_setup,
  javascript_syntax_highlighting,
} from "../../codemirror-javascript-setup.js";
import { DecorationsFromTree } from "../../basic-markdown-setup.jsx";

import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import { DEFAULT_TO_PARSE } from "./default-to-parse.js";
import {
  create_worker,
  post_message,
} from "../../packages/babel-worker/babel-worker.js";

import "../../App.css";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";

let VARIABLE_COLOR = "rgb(255 130 41)";
let PROPERTY_COLOR = "#d01212";

let syntax_classes = EditorView.theme({
  ".very-important": {
    color: "white",
    fontWeight: 700,
  },
  ".important": {
    color: "white",
  },
  ".boring": {
    // color: "#008c85",
    color: "#787878",
  },

  ".property": {
    color: PROPERTY_COLOR,
  },
  ".variable": {
    color: VARIABLE_COLOR,
    fontWeight: 700,
  },
  ".literal": {
    color: "#00a7ca",
  },
  ".comment": {
    color: "#747474",
    fontStyle: "italic",
  },
});

let lezer_extension = lezer();
let lezer_highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.lineComment, class: "comment" },
    { tag: t.blockComment, class: "comment" },
    { tag: t.character, class: "literal" },
    { tag: t.string, class: "literal" },
    { tag: t.keyword, class: "important" },
    { tag: t.modifier, class: "green" },
    { tag: t.definitionKeyword, class: "important" },
    { tag: t.operatorKeyword, class: "important" },
    { tag: t.regexp, class: "literal" },
    { tag: t.atom, class: "literal" },
    { tag: t.variableName, class: "variable" },
    { tag: t.definition(t.variableName), class: "variable" },
    { tag: t.labelName, class: "property" },
    { tag: t.name, class: "variable" },
    { tag: t.paren, class: "boring" },
    { tag: t.squareBracket, class: "boring" },
    { tag: t.brace, class: "boring" },
    { tag: t.operator, class: "very-important" },
  ])
);

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

let base_extensions = [
  EditorView.theme({
    ".cm-gutters": {
      "background-color": "transparent",
      color: "#6c6c6c",
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

  // Make awesome line wrapping indent wrapped lines a liiiiitle bit (1 character) more than the first line
  EditorView.theme({
    ".awesome-wrapping-plugin-the-line": {
      "margin-left": "calc(var(--indented) + 1ch)",
      "text-indent": "calc(-1 * var(--indented) - 1ch)",
    },
  }),

  EditorState.tabSize.of(2),
  placeholder("The rest is still unwritten..."),
  bracketMatching({}),
  closeBrackets(),
  highlightSelectionMatches(),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),
  EditorView.lineWrapping,

  search({
    caseSensitive: false,
    top: true,
  }),

  // COUGH SHARED HITORY COUGH
  history(),
  keymap.of(historyKeymap),
  keymap.of(searchKeymap),

  EditorView.lineWrapping,
  awesome_line_wrapping,

  // EditorView.theme({
  //   ".cm-line": {
  //     "margin-left": "1ch",
  //     "text-indent": "-1ch",
  //   },
  // }),
];

/** @param {{ doc: string, onChange: (str: string) => void }} props */
export let LezerEditor = ({ doc, onChange }) => {
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
      <Extension extension={lezer_extension} />
      <Extension extension={on_change_extension} />
      <Extension extension={syntax_classes} />
      <Extension extension={lezer_highlight} />
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
 *  parser: LRParser | null,
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

  let js_result = just_success(js_stuff);

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
    <div style={{ height: "100%", position: "relative" }}>
      <CodeMirror state={initial_editor_state}>
        <Extension extension={on_change_extension} />
        <Extension extension={parser_extension} />
        <Extension extension={custom_extensions} />
        <Extension extension={exceptionSinkExtension} />
      </CodeMirror>
    </div>
  );
};

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
    let error = this.state.error;
    let should_still_error =
      error != null && this.last_js_stuff == this.props.js_stuff;
    let js_stuff = should_still_error ? Failure.of(error) : this.props.js_stuff;

    if (!should_still_error) {
      this.last_js_stuff = this.props.js_stuff;
      if (error != null) {
        this.setState({ error: null });
      }
    }

    console.log(`this.props:`, this.props);

    return (
      <div style={{ height: "100%", position: "relative" }}>
        <WhatToParseEditor {...this.props} js_stuff={js_stuff} />
        {should_still_error && (
          <div
            style={{
              color: "#d01212",
              position: "absolute",
              bottom: 8,
              right: 8,
              padding: 16,
            }}
          >
            <b>Plugin Crashed</b>
            {/* @ts-ignore */}
            <pre>{error.message}</pre>
          </div>
        )}
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
    if (/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(cursor.name)) {
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

/**
 * @template T
 * @param {ExecutionResult<T>} result
 */
let just_success = (result) => {
  if (result instanceof Success) {
    return result.value;
  } else {
    return null;
  }
};

/**
 * @param {{
 *  code_to_parse: string,
 *  parser: LRParser,
 * }} props
 */
export let ParsedResultEditor = ({ code_to_parse, parser }) => {
  let parsed = React.useMemo(() => {
    return parser.parse(code_to_parse);
  }, [parser, code_to_parse]);

  let parsed_as_json = React.useMemo(() => {
    // @ts-ignore
    let str = cursor_to_js(parsed.cursor());
    try {
      return Success.of(
        format_with_prettier({
          code: str,
          cursor: 0,
        }).formatted
      );
    } catch (error) {
      console.log(`error:`, error);
      return Success.of(str);
    }
  }, [parsed]).or(code_to_parse);

  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc: parsed_as_json,
      extensions: [base_extensions, EditorView.editable.of(false)],
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
 * @param {string} code
 * @param {{ [argument: string]: any }} globals
 */
let get_cell_run_function = (code, globals) => {
  let f = new Function(...Object.keys(globals), code);
  return () => f(...Object.values(globals));
};

/**
 * @template T
 * @typedef ExecutionResult
 * @type {Success<T> | Failure | Loading}
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
   * @returns {Success<R> | Failure}
   */
  map(f) {
    try {
      return new Success(f(this.value));
    } catch (error) {
      console.log(`error:`, error);
      return new Failure(error);
    }
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
class Failure {
  constructor(value) {
    this.value = value;
  }
  /**
   * @template T
   * @param {T} value
   */
  or(value) {
    return value;
  }
  map(f) {
    return this;
  }
  static of(value) {
    return new Failure(value);
  }
}
class Loading {
  map(f) {
    return this;
  }
  /**
   * @template T
   * @param {T} value
   */
  or(value) {
    return value;
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
 * @param {() => Promise<T>} fn
 * @param {any[]} deps
 * @returns {ExecutionResult<T>}
 */
let usePromise = (fn, deps) => {
  let [value, set_value] = React.useState(
    /** @type {ExecutionResult<T>} */ (Loading.of())
  );

  React.useEffect(() => {
    fn().then(
      (value) => set_value(Success.of(value)),
      (error) => set_value(Failure.of(error))
    );
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
}

let storage = {
  parser_code: new ScopedStorage("lezer-playground.parser_code"),
  javascript_stuff: new ScopedStorage("lezer-playground.javascript_stuff"),
  code_to_parse: new ScopedStorage("lezer-playground.code_to_parse"),
};

let useScopedStorage = (
  /** @type {ScopedStorage} */ storage,
  default_value
) => {
  let [value, set_value] = React.useState(storage.get() ?? default_value);

  let set_value_and_store = React.useCallback(
    (value) => {
      set_value(value);
      storage.set(value);
    },
    [storage]
  );

  return [value, set_value_and_store];
};

let GeneralEditorStyles = styled.div`
  height: 100%;
  font-family: Menlo, "Roboto Mono", "Lucida Sans Typewriter", "Source Code Pro",
    monospace;

  & .cm-scroller {
    /* padding-left: 16px; */
    padding-right: 16px;
  }
  & .cm-content {
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }

  & .cm-panels {
    filter: invert(1);
  }
`;

let PaneStyle = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 4px;
`;

let PaneHeader = styled.div`
  padding-top: 3px;
  padding-bottom: 4px;
  padding-left: 18px;
  padding-right: 18px;
  font-weight: bold;
  background-color: #300000;
  font-size: 12px;
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

  display: grid;
  grid-template: 
    "lezer-editor      ↑ what-to-parse-editor " minmax(0, 1fr)
    " ←                █                    → " 8px
    "javascript-stuff  ↓       parsed-result  " minmax(0, 1fr)
    / 1fr 8px 1fr;
`;

export let App = () => {
  let [parser_code, set_parser_code] = useScopedStorage(
    storage.parser_code,
    DEFAULT_PARSER_CODE
  );

  let [code_to_parse, set_code_to_parse] = useScopedStorage(
    storage.code_to_parse,
    DEFAULT_TO_PARSE
  );

  let [javascript_stuff, set_javascript_stuff] = useScopedStorage(
    storage.javascript_stuff,
    DEFAULT_JAVASCRIPT_STUFF
  );

  let parser = React.useMemo(() => {
    try {
      return Success.of(buildParser(parser_code));
    } catch (error) {
      return Failure.of(error);
    }
  }, [parser_code]);

  let lezer_on_change = React.useCallback(
    (str) => {
      set_parser_code(str);
    },
    [set_parser_code]
  );
  let code_to_parse_on_change = React.useCallback(
    (str) => {
      set_code_to_parse(str);
    },
    [set_code_to_parse]
  );
  let javascript_stuff_on_change = React.useCallback(
    (str) => {
      set_javascript_stuff(str);
    },
    [set_javascript_stuff]
  );

  let [worker, set_worker] = React.useState(/** @type {any} */ (null));
  React.useEffect(() => {
    let worker = create_worker();

    set_worker(worker);

    return () => {
      worker.terminate();
    };
  }, [create_worker]);

  let javascript_parsed = usePromise(async () => {
    if (worker != null) {
      return await post_message(worker, {
        type: "transform-code",
        data: { code: javascript_stuff },
      });
    } else {
      return Loading.of();
    }
  }, [worker, javascript_stuff]);

  let javascript_fn = React.useMemo(() => {
    return javascript_parsed.map((parsed) => {
      let import_map = {
        "@lezer/highlight": () => import("@lezer/highlight"),
        "@codemirror/language": () => import("@codemirror/language"),
        "@codemirror/view": () => import("@codemirror/view"),
        "@codemirror/state": () => import("@codemirror/state"),
        "style-mod": () => import("style-mod"),
      };

      return get_cell_run_function(parsed.code, {
        styleTags,
        __meta__: {
          url: new URL(
            "./lezer-playground.js",
            window.location.href
          ).toString(),
          import: (specifier) => {
            let fn = import_map[specifier];
            if (fn == null) return import(specifier);
            return fn();
          },
        },
      });
    });
  }, [javascript_parsed]);

  let javascript_result = React.useMemo(() => {
    return javascript_fn.map((fn) => fn()) ?? null;
  }, [javascript_fn]);

  let js_stuff = usePromise(async () => {
    if (javascript_result instanceof Success) {
      return await javascript_result.value;
    } else if (javascript_result instanceof Failure) {
      throw javascript_result.value;
    } else {
      return Loading.of();
    }
  }, [javascript_result]);

  return (
    <AppGrid
      style={
        {
          // @ts-ignore
          // "--top-imbalance": "100px",
        }
      }
    >
      <Pane style={{ gridArea: "lezer-editor" }} header="Lezer Grammar">
        <GeneralEditorStyles>
          <LezerEditor doc={parser_code} onChange={lezer_on_change} />
        </GeneralEditorStyles>
      </Pane>

      <Pane style={{ gridArea: "what-to-parse-editor" }} header="Test Code">
        <GeneralEditorStyles>
          <WhatToParseEditorWithErrorBoundary
            doc={code_to_parse}
            onChange={code_to_parse_on_change}
            js_stuff={js_stuff}
            parser={parser instanceof Success ? parser.value : null}
          />
        </GeneralEditorStyles>
      </Pane>

      <Pane style={{ gridArea: "parsed-result" }} header="Lezer Tree">
        <GeneralEditorStyles>
          {parser instanceof Success ? (
            <ParsedResultEditor
              code_to_parse={code_to_parse}
              parser={parser.value}
            />
          ) : (
            <pre style={{ color: "red", padding: 8 }}>
              {parser.value.toString()}
            </pre>
          )}
        </GeneralEditorStyles>
      </Pane>

      <Pane style={{ gridArea: "javascript-stuff" }} header="Javascript Code">
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

      {js_stuff instanceof Failure && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            maxWidth: "70%",
            backgroundColor: "#d01212",
            overflow: "auto",
            padding: 16,
          }}
        >
          <pre>{js_stuff.value.message}</pre>
          <details>
            <summary style={{ alignSelf: "flex-end" }}>Show Stacktrace</summary>
            <pre>{js_stuff.value.stack}</pre>
          </details>
        </div>
      )}
    </AppGrid>
  );
};
