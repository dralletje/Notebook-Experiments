import React from "react";
import styled from "styled-components";
import { EditorState, StateEffect } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
  runScopeHandlers,
} from "@codemirror/view";
import {
  bracketMatching,
  LanguageSupport,
  LRLanguage,
  syntaxTree,
} from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { defaultKeymap } from "@codemirror/commands";
import { LRParser } from "@lezer/lr";
import { IoBonfire, IoLogoGithub } from "react-icons/io5";
import usePath from "react-use-path";

import { Extension } from "codemirror-x-react";
import {
  useViewUpdate,
  CodemirrorFromViewUpdate,
} from "codemirror-x-react/viewupdate";
import {
  awesome_line_wrapping,
  MaxIdentationSpacesFacet,
} from "codemirror-awesome-line-wrapping";
import { LezerGeneratorWorker } from "@dral/lezer-generator-worker/lezer-generator-worker.js";
import { TransformJavascriptWorker } from "@dral/dralbook-transform-javascript/worker/transform-javascript-worker.js";

////////////////////
import { basic_javascript_setup } from "./should-be-shared/codemirror-javascript-setup.js";
import { dot_gutter } from "./should-be-shared/codemirror-dot-gutter.jsx";
////////////////////

import { ParsedResultEditor } from "./parsed-result-editor/parsed-result-editor.jsx";
import { lezer_syntax_extensions } from "./editors/lezer-editor.js";
import {
  Failure,
  Loading,
  Success,
  useMemoizeSuccess,
  usePromise,
} from "./use/OperationMonadBullshit.js";
import { useWorker, useWorkerPool } from "./use/useWorker.js";
import { ScopedStorage, useScopedStorage } from "./use/scoped-storage.js";
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
  EditorState.tabSize.of(2),
  placeholder("The rest is still unwritten..."),
  bracketMatching({}),
  closeBrackets(),
  highlightSelectionMatches(),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),

  search({
    caseSensitive: true,
    top: true,
  }),
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

/** @param {{ viewupdate: import("codemirror-x-react/viewupdate").GenericViewUpdate, result: ExecutionResult<any>, error: Error? }} props */
export let LezerEditor = ({ viewupdate, result, error }) => {
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
    <CodemirrorFromViewUpdate viewupdate={viewupdate}>
      <Extension extension={base_extensions} />
      <Extension extension={lezer_syntax_extensions} />
      <Extension extension={awesome_line_wrapping} />
      <Extension extension={error_extension} />
    </CodemirrorFromViewUpdate>
  );
};

/** @param {{ viewupdate: import("codemirror-x-react/viewupdate").GenericViewUpdate, error: Error? }} props */
export let JavascriptStuffEditor = ({ viewupdate, error }) => {
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
    <CodemirrorFromViewUpdate viewupdate={viewupdate}>
      <Extension extension={base_extensions} />
      <Extension extension={basic_javascript_setup} />
      <Extension extension={error_extension} />
    </CodemirrorFromViewUpdate>
  );
};

/** @type {Array<import("@codemirror/state").Extension>} */
let NO_EXTENSIONS = [];

let what_to_parse_theme = [
  EditorView.theme({
    ".cm-selectionMatch": {
      "text-shadow": "0 0 13px rgb(255 255 255 / 70%) !important",
    },
  }),
];

let dont_space_too_much = MaxIdentationSpacesFacet.of(10);

/**
 * @param {{
 *  viewupdate: import("codemirror-x-react/viewupdate.js").GenericViewUpdate,
 *  parser: import("@lezer/lr").LRParser | null,
 *  js_stuff: ExecutionResult<{
 *    extensions: import("@codemirror/state").Extension[],
 *  }>
 * }} props */
export let WhatToParseEditor = ({ viewupdate, parser, js_stuff }) => {
  let js_result = js_stuff.or(null);

  let parser_extension = React.useMemo(() => {
    if (parser) {
      // @ts-ignore
      let language = LRLanguage.define({ parser: parser });
      return new LanguageSupport(language);
    } else {
      return EditorView.updateListener.of(() => {});
    }
  }, [parser]);

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

  // Try adding the parser extension to the list of extensions to see if it doesn't error.
  // If it does, we throw the error to the error boundary.
  // This is necessary because an error on the state/extension side would otherwise kill the whole app
  // (because it would be thrown from the Nexus state...)
  React.useMemo(() => {
    if (custom_extensions != null) {
      viewupdate.startState.update({
        effects: StateEffect.appendConfig.of(custom_extensions),
      }).state;
    }
  }, [custom_extensions]);

  return (
    <CodemirrorFromViewUpdate viewupdate={viewupdate}>
      <Extension extension={base_extensions} />
      <Extension extension={parser_extension} />
      <Extension extension={custom_extensions} />
      <Extension extension={exceptionSinkExtension} />
      <Extension extension={awesome_line_wrapping} />
      <Extension extension={what_to_parse_theme} />
      <Extension extension={dont_space_too_much} />
    </CodemirrorFromViewUpdate>
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
        // React will whine about this, but it's fine.
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
          <WhatToParseEditor
            key={js_stuff_safe != null ? "error" : "fine"}
            {...props}
            js_stuff={js_stuff_safe}
          />
        </div>

        {errors_with_component_error.length > 0 && (
          <ErrorBox>
            {errors_with_component_error.map((error) => (
              <React.Fragment key={error.title}>
                <h1>{error.title}</h1>
                {/* @ts-ignore */}
                <pre>{error.error.message}</pre>
              </React.Fragment>
            ))}
          </ErrorBox>
        )}
      </div>
    );
  }
}

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
  font-family: var(--mono-font-family);

  & .cm-scroller {
    /* padding-left: 16px; */
  }
  & .cm-content {
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    padding-right: 16px;
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

  user-select: none;
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

  ${PaneHeader}, .cm-panels {
    background-size: 50px 50px;
    background-color: #ffffff17;
    background-image: url("${NOISE_BACKGROUND}");
  }

  .cm-panels {
    color: #ffffff75;
    border-bottom: none;
  }
  .cm-search {
    font-size: 1rem;
    font-family: var(--mono-font-family);

    display: flex;
    flex-direction: row;
    align-items: center;

    [name="select"],
    [name="replace"],
    [name="replaceAll"],
    label {
      display: none;
    }

    input,
    button {
      border: none;
      border-radius: 2px !important;
      font-family: inherit;
    }
    input:focus-visible,
    button:focus-visible {
      outline: 2px #ffffff4f solid;
    }

    [name="search"] {
      flex: 1;
    }

    [name="close"] {
      position: relative !important;
      /* margin-left: 8px !important; */
      margin-left: 4px !important;
      padding-right: 4px !important;
      padding-left: 4px !important;
    }
  }

  .cm-textfield {
    color: white;
    background-color: #0000006b;
  }
  .cm-button {
    background: none;
    background-color: black;
  }

  .cm-content,
  .cm-gutters {
    background-size: 50px 50px;
    background-image: url("${NOISE_BACKGROUND}");

    &.cm-gutters {
      background-position: right;
    }
  }
`;

let Pane = ({ children, header, ...props }) => {
  return (
    <PaneStyle {...props}>
      <PaneHeader>{header}</PaneHeader>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </PaneStyle>
  );
};

let AppGrid = styled.div`
  width: 100vw;
  height: 100vh;
  border: solid 8px black;
  background-color: black;

  /* Because we have a header bar */
  border-top: 0;

  display: grid;
  grid-template:
    " header              header           header " 30px
    " what-to-parse-editor  ↑       parsed-result " minmax(0, 1fr)
    "  ←                    █                  →  " 8px
    " lezer-editor          ↓    javascript-stuff " minmax(0, 1fr)
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
      {errors.slice(0, 1).map((error, index) => (
        // TODO Using `index` here is wrong, but it doesn't hurt too much
        <React.Fragment key={index}>
          <div style={{ minWidth: 8 }} />
          <IoBonfire style={{ color: ERROR_COLOR }} />
        </React.Fragment>
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

let FillAndCenter = styled.div`
  height: 100%;
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  text-align: center;
`;

import { compact, groupBy, range, sortBy, uniq } from "lodash";
import {
  CellHasSelectionField,
  create_nested_editor_state,
  NestedEditorStatesField,
  NestedExtension,
  nested_cell_states_basics,
  nested_view_update,
} from "./should-be-shared/MultiEditor";
import {
  shared_history,
  historyKeymap,
  historyField,
} from "./should-be-shared/codemirror-shared-history";
import { lezerLanguage } from "@codemirror/lang-lezer";
import { iterate_over_cursor } from "dral-lezer-helpers";

/** @param {{ project_name: string }} props */
let Editor = ({ project_name }) => {
  let main_scope = new ScopedStorage("lezer-playground").child(project_name);

  let [_parser_code, set_parser_code] = useScopedStorage(
    main_scope.child("parser_code"),
    DEFAULT_PARSER_CODE
  );
  let [javascript_stuff, set_javascript_stuff] = useScopedStorage(
    main_scope.child("javascript_stuff"),
    DEFAULT_JAVASCRIPT_STUFF
  );
  let [code_to_parse, set_code_to_parse] = useScopedStorage(
    main_scope.child("code_to_parse"),
    DEFAULT_TO_PARSE
  );

  let do_run_storage = main_scope.child("run");
  let [do_run, set_do_run] = useScopedStorage(do_run_storage, true);

  do_run_storage.set(false);
  React.useLayoutEffect(() => {
    do_run_storage.set(true);
  });

  let initial_state = React.useMemo(() => {
    let notebook_state = NestedEditorStatesField.init((editorstate) => {
      return {
        cells: {
          "lezer-grammar": create_nested_editor_state({
            parent: editorstate,
            cell_id: "lezer-grammar",
            doc: _parser_code,
          }),
          javascript: create_nested_editor_state({
            parent: editorstate,
            cell_id: "javascript",
            doc: javascript_stuff,
          }),
          "code-to-parse": create_nested_editor_state({
            parent: editorstate,
            cell_id: "code-to-parse",
            doc: code_to_parse,
          }),
        },
        transactions_to_send_to_cells: [],
        cell_with_current_selection: null,
      };
    });

    // Keep history state in localstorage so you don't lose your history whaaaaaat
    let history = null;
    try {
      let history_field_json = main_scope.child("history").get();
      let restored_state = EditorState.fromJSON(
        {
          doc: "",
          selection: { main: 0, ranges: [{ anchor: 0, head: 0 }] },
          history: history_field_json,
        },
        {},
        {
          history: historyField,
        }
      );
      history = restored_state.field(historyField);
    } catch (error) {}

    return EditorState.create({
      extensions: [
        notebook_state,
        nested_cell_states_basics,

        history != null ? historyField.init(() => history) : [],

        // This works so smooth omg
        [shared_history(), keymap.of(historyKeymap)],
      ],
    });
  }, []);

  let [state, set_state] = React.useState(initial_state);

  let viewupdate = useViewUpdate(state, set_state);

  let lezer_grammar_viewupdate = React.useMemo(
    () => nested_view_update(viewupdate, "lezer-grammar"),
    [viewupdate]
  );
  let code_to_parse_viewupdate = React.useMemo(
    () => nested_view_update(viewupdate, "code-to-parse"),
    [viewupdate]
  );
  let javascript_stuff_viewupdate = React.useMemo(
    () => nested_view_update(viewupdate, "javascript"),
    [viewupdate]
  );

  React.useEffect(() => {
    for (let transaction of lezer_grammar_viewupdate.transactions) {
      if (transaction.docChanged) {
        set_parser_code(transaction.newDoc.toString());
      }
    }
  }, [lezer_grammar_viewupdate]);
  React.useEffect(() => {
    for (let transaction of code_to_parse_viewupdate.transactions) {
      if (transaction.docChanged) {
        set_code_to_parse(transaction.newDoc.toString());
      }
    }
  }, [code_to_parse_viewupdate]);
  React.useEffect(() => {
    for (let transaction of javascript_stuff_viewupdate.transactions) {
      if (transaction.docChanged) {
        set_javascript_stuff(transaction.newDoc.toString());
      }
    }
  }, [javascript_stuff_viewupdate]);

  // Use the nexus' keymaps as shortcuts!
  // This passes on keydown events from the document to the nexus for handling.
  React.useEffect(() => {
    let fn = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      let should_cancel = runScopeHandlers(
        // @ts-ignore
        viewupdate.view,
        event,
        "editor"
      );
      if (should_cancel) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
    };
  }, [viewupdate.view]);

  React.useEffect(() => {
    let serialized = state.toJSON({
      history: historyField,
    });
    // console.log(`serialized:`, serialized);
    main_scope.child("history").set(serialized.history);
  }, [state]);

  let parser_code = lezer_grammar_viewupdate.state.doc.toString();

  let babel_worker = useWorker(() => new TransformJavascriptWorker(), []);
  let get_lezer_worker = useWorkerPool(() => new LezerGeneratorWorker());

  let generated_parser_code = usePromise(
    async (signal) => {
      if (!do_run) {
        throw new Error("Not running");
      }

      // Find empty Body's in the lezer parser, which will definitely lead to an infinite loop
      let tree = lezerLanguage.parser.parse(parser_code);
      iterate_over_cursor({
        cursor: tree.cursor(),
        enter: (cursor) => {
          if (cursor.name === "Body") {
            if (cursor.node.parent?.name === "SkipScope") {
              return;
            }

            let has_a_child = false;
            if (cursor.firstChild()) {
              try {
                do {
                  if (/^[A-Z0-9][A-Z0-9a-z]*$/.test(cursor.name)) {
                    has_a_child = true;
                  }
                } while (cursor.nextSibling());
              } finally {
                cursor.parent();
              }
              if (!has_a_child) {
                throw new Error(`Empty Body (add line:col here)`);
              }
            } else {
              throw new Error(`Empty Body (add line:col here)`);
            }
          }
        },
      });

      // Build the parser file first
      return await get_lezer_worker(signal).request("build-parser", {
        code: parser_code,
      });
    },
    [parser_code, get_lezer_worker, do_run]
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
      if (!do_run) {
        throw new Error("Not running");
      }

      if (babel_worker == null) {
        throw Loading.of();
      }

      // Run the javascript file,
      // with the terms file as a possible import
      let our_javascript_code = await babel_worker.request("transform-code", {
        code: javascript_stuff,
      });

      let load_terms_file = async () => {
        if (terms_file_result instanceof Failure) {
          // prettier-ignore
          throw new TypeError(`Failed to resolve module specifier './parser.terms.js'`);
        }
        if (terms_file_result instanceof Loading) {
          throw new TermsFileNotReadyError();
        }
        return terms_file_result.get();
      };

      let import_map = {
        "@lezer/highlight": () => import("@lezer/highlight"),
        "@codemirror/language": () => import("@codemirror/language"),
        "@codemirror/view": () => import("@codemirror/view"),
        "@codemirror/state": () => import("@codemirror/state"),
        "style-mod": () => import("style-mod"),
        "@lezer/lr": () => import("@lezer/lr"),
      };

      try {
        let untyped_result = await run_cell_code(our_javascript_code.code, {
          __meta__: {
            // prettier-ignore
            url: new URL("./lezer-playground.js", window.location.href).toString(),
            import: async (specifier, imported) => {
              if (specifier.endsWith(".terms.js") || specifier === ".terms") {
                return await load_terms_file();
              }

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
    [
      terms_file_result,
      babel_worker,
      javascript_stuff,
      terms_file_result,
      do_run,
    ]
  );

  let parser = usePromise(async () => {
    if (babel_worker == null) {
      throw Loading.of();
    }
    if (generated_parser_code instanceof Failure) {
      throw new Error("Failed to compile lezer grammar");
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

  // Add a class to the body whenever the mouse is held down
  React.useEffect(() => {
    let mouse_down_listener = () => {
      document.body.classList.add("mouse-down");
    };
    let mouse_up_listener = () => {
      document.body.classList.remove("mouse-down");
    };
    document.addEventListener("mousedown", mouse_down_listener);
    document.addEventListener("mouseup", mouse_up_listener);
    return () => {
      document.removeEventListener("mousedown", mouse_down_listener);
      document.removeEventListener("mouseup", mouse_up_listener);
    };
  }, []);

  let onSelection = React.useCallback(
    (/** @type {readonly [Number, number]} */ [from, to]) => {
      code_to_parse_viewupdate.view.dispatch({
        selection: { anchor: to, head: from },
        scrollIntoView: true,
      });
    },
    []
  );

  return (
    <AppGrid>
      <Pane
        style={{ gridArea: "lezer-editor", backgroundColor: "#010539" }}
        header={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
            }}
          >
            <PaneTab
              title="lezer grammar"
              process={[generated_parser_code, parser]}
            />

            <div style={{ flex: 1 }} />
            <input
              type="checkbox"
              checked={do_run}
              onChange={(e) => {
                set_do_run(e.target.checked);
              }}
            />
          </div>
        }
      >
        <GeneralEditorStyles>
          <LezerEditor
            error={
              generated_parser_code instanceof Failure
                ? generated_parser_code.value
                : null
            }
            viewupdate={lezer_grammar_viewupdate}
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
            viewupdate={code_to_parse_viewupdate}
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
                ? { title: "Parser generation", error: parser.value }
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
          <React.Suspense
            fallback={
              <FillAndCenter>
                <pre style={{ color: "#ffff004d" }}>
                  Waiting for{"\n"}editor to load..
                </pre>
              </FillAndCenter>
            }
          >
            {parser_in_betweens instanceof Success ? (
              <ParsedResultEditor
                code_to_parse_viewupdate={code_to_parse_viewupdate}
                parser={parser_in_betweens.value}
                code_to_parse={code_to_parse}
                onSelection={onSelection}
              />
            ) : parser_in_betweens instanceof Failure ? (
              <FillAndCenter>
                <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
                  {parser_in_betweens.value.toString()}
                </pre>
              </FillAndCenter>
            ) : (
              <FillAndCenter>
                <pre style={{ color: "#ffff004d" }}>
                  Waiting for{"\n"}parser to compile..
                </pre>
              </FillAndCenter>
            )}
          </React.Suspense>
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
            viewupdate={javascript_stuff_viewupdate}
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

      <div
        style={{
          gridArea: "header",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          userSelect: "none",
        }}
      >
        <span
          style={{
            flex: 1,
            alignSelf: "stretch",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          <ProjectsDropdown />
          <LoadSampleDropdown scoped_storage={main_scope} />
        </span>
        <span style={{ fontWeight: "bold" }}>Lezer Playground</span>
        <span
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <SimpleLink href="https://github.com/dralletje/Notebook-Experiments/tree/main/lezer-playground">
            <IoLogoGithub title="Github Repository" style={{ fontSize: 16 }} />
          </SimpleLink>
        </span>
      </div>
    </AppGrid>
  );
};

let SimpleLink = styled.a`
  cursor: pointer;
  &:hover {
    color: #00e1ff;
  }
`;

let ProjectDropdownStyle = styled.div`
  position: relative;

  button {
    border: none;
    height: 100%;
    padding: 0 8px;
    font-weight: normal;

    body:not(.mouse-down) &:hover {
      background-color: white;
      color: black;
    }
  }

  .menu {
    display: flex;
    background-color: black;
    min-width: 150px;
    font-size: 16px;

    flex-direction: column;

    border: solid 4px white;

    a {
      padding: 8px 16px;
      white-space: pre;
      cursor: pointer;
      font-family: var(--mono-font-family);

      border-top: solid white 2px;
      &:first-child {
        border-top: none;
      }

      &.active {
        cursor: unset;
        color: #37ff61;
        font-weight: bold;
        background-color: #323232;
      }

      &:not(.active):hover {
        background-color: white;
        color: black;
      }
    }
  }

  .help {
    width: 300px;
    background-color: black;
    font-size: 16px;
    padding: 16px;
    border: solid 4px white;
    border-left: none;
  }

  .dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;

    flex-direction: row;
  }

  body:not(.mouse-down) &:has(button:hover),
  &:has(.dropdown:hover) {
    .dropdown {
      display: flex;
    }
    button {
      background-color: white;
      color: black;
    }
  }
`;

/** @param {Storage} storage */
let storage_keys = function* (storage) {
  for (let i of range(0, storage.length)) {
    let key = storage.key(i);
    if (key != null) {
      yield key;
    }
  }
};

let ProjectsDropdown = () => {
  let path = window.location.pathname;

  let project_names = sortBy(
    uniq(
      Array.from(storage_keys(localStorage))
        .map((x) => x.split("."))
        .filter((x) => x[0] === "lezer-playground")
        .map((x) => x[1])
    )
  );

  return (
    <ProjectDropdownStyle>
      <button>projects</button>
      <div className="dropdown">
        <div className="menu">
          {project_names.map((project_name) => (
            <a
              className={path === project_name ? "active" : ""}
              key={project_name}
              href={project_name}
            >
              {project_name}
            </a>
          ))}
        </div>
        <div className="help">
          To open a new project, change the path to something not listed here.
        </div>
      </div>
    </ProjectDropdownStyle>
  );
};

let path_prefix = "./premade-projects/";
// @ts-expect-error - Vite glob 😎
const modules = import.meta.glob("./premade-projects/**/*", { as: "raw" });
let premade_projects = {};
for (let [path, import_module] of Object.entries(modules)) {
  let [project, filename] = path.slice(path_prefix.length).split("/");
  premade_projects[project] ??= {};

  if (filename.startsWith("example.")) {
    premade_projects[project].example = import_module;
  } else if (filename === "external.js") {
    premade_projects[project].external = import_module;
  } else if (filename.endsWith(".grammar")) {
    premade_projects[project].grammar = import_module;
  } else {
    console.error(`Unknown file type: ${path}/${filename}`);
  }
}

let LoadSampleDropdown = ({ scoped_storage }) => {
  let path = window.location.pathname;
  let project_names = Object.keys(premade_projects);

  return (
    <ProjectDropdownStyle>
      <button>load</button>
      <div className="dropdown">
        <div className="menu">
          {project_names.map((project_name) => (
            <a
              key={project_name}
              onClick={() => {
                Promise.all([
                  premade_projects[project_name].example(),
                  premade_projects[project_name].grammar(),
                  premade_projects[project_name].external(),
                ]).then(([example, grammar, external]) => {
                  scoped_storage.child("code_to_parse").set(example),
                    scoped_storage.child("javascript_stuff").set(external),
                    scoped_storage.child("parser_code").set(grammar),
                    window.location.reload();
                });
              }}
            >
              {project_name}
            </a>
          ))}
        </div>
        <div className="help">
          Load an existing parser.
          <br />
          <br />
          I've compiled those from github, mashing the javascript files
          together. Maybe in the future I'll make a way to actually import from
          github.
          <br />
          <br />
          <b>This will override the project you have open currently!</b>
        </div>
      </div>
    </ProjectDropdownStyle>
  );
};
