import React from "react";
import styled from "styled-components";
import { EditorState } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import {
  bracketMatching,
  LanguageSupport,
  LRLanguage,
} from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { LRParser } from "@lezer/lr";
import { IonIcon } from "@ionic/react";
import { bonfire } from "ionicons/icons";
import usePath from "react-use-path";

import { CodeMirror, Extension } from "codemirror-x-react";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { LezerGeneratorWorker } from "@dral/lezer-generator-worker/lezer-generator-worker.js";
import { TransformJavascriptWorker } from "@dral/dralbook-transform-javascript/worker/transform-javascript-worker.js";

////////////////////
import { basic_javascript_setup } from "../../codemirror-javascript-setup.js";
////////////////////

import {
  ParsedResultEditor,
  let_me_know_what_node_i_clicked,
} from "./CodemirrorInspector.jsx";
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
import { dot_gutter } from "./codemirror-dot-gutter.jsx";
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

import {
  CellEditorStatesField,
  CellPlugin,
  editor_state_for_cell,
  nested_cell_states_basics,
} from "../../NotebookEditor.ts";
import { compact } from "lodash";

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
