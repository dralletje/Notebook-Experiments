import React from "react";
import styled from "styled-components";
import { EditorState } from "@codemirror/state";

import { useViewUpdate } from "codemirror-x-react/viewupdate";
import { ScrollIntoViewButOnlyTheEditorEffect } from "./should-be-shared/ScrollIntoViewButOnlyTheEditor";
import { ParsedResultEditor } from "./editors/parsed-result-editor/parsed-result-editor";
import {
  Failure,
  Loading,
  Success,
  useMemoizeSuccess,
} from "./use/OperationMonadBullshit.js";
import { ScopedStorage, useScopedStorage } from "./use/scoped-storage.js";
import {
  DEFAULT_JAVASCRIPT_STUFF,
  DEFAULT_PARSER_CODE,
  DEFAULT_TO_PARSE,
} from "./default-field-codes.js";
import "./App.css";
import { useCodemirrorKeyhandler } from "../../simple-notebooks/web-app/src/use/use-codemirror-keyhandler";
import { JavascriptStuffEditor } from "./editors/javascript-editor/javascript-editor";
import { LezerEditor } from "./editors/lezer-editor/lezer-editor";

import { compact, isEmpty, round } from "lodash-es";
import {
  EditorInChief,
  EditorInChiefKeymap,
  as_editor_id,
  extract_nested_viewupdate,
} from "codemirror-editor-in-chief";
import {
  shared_history,
  historyKeymap,
  historyField,
} from "codemirror-editor-in-chief/history";
import { LezerErrorEditor } from "./editors/lezer-editor/lezer-error-editor";
import { AppHeader } from "./Header.jsx";
import {
  useJavascriptResult,
  useLezerCompiled,
  useLezerInstantiated,
} from "./ugh/run-whole-compilation-pipeline.js";
import { useSearchParamState, useUrl } from "./use/use-url.js";
import { WhatToParseEditorWithErrorBoundary } from "./editors/what-to-parse-editor/what-to-parse-editor-with-error-boundary.jsx";
import { Pane, PaneTab } from "./panel/panel.jsx";

export let App = () => {
  let [url] = useUrl();
  let path = url.pathname;

  return <Editor project_name={path} />;
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
    " what-to-parse-editor  .       parsed-result " minmax(0, 2fr)
    "  .                    .               .     " 8px
    " lezer-editor          .    javascript-stuff " minmax(0, 3fr)
    / 1fr 8px 1fr;

  /* Media query for mobile:
     Who wants to use this on mobile????
     Nobody! But I still want it to work LOL */
  @media (max-width: 800px) {
    height: 100vh;
    height: 100dvh;
    grid-template:
      " header               header                header     █ " 30px
      "lezer-editor   what-to-parse-editor  javascript-stuff  █ " 1fr
      "lezer-editor      parsed-result      javascript-stuff  █ " 1fr
      / 100% 100% 100% 8px;
    gap: 8px;

    .pane {
      scroll-snap-align: center;
    }
  }
`;

let FillAndCenter = styled.div`
  height: 100%;
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  text-align: center;
`;

let AppScroller = styled.div`
  height: 100vh;
  width: 100vw;
  background-color: black;

  overflow-x: auto;
  scroll-snap-points-x: repeat(100vw);
  scroll-snap-type: x mandatory;
`;

let lezer_playground_storage = new ScopedStorage("lezer-playground");

let PaneSelect = styled.select`
  border: none;
  font-size: 0.9em;
  padding-inline: 4px;
`;

let Runtime = styled.div`
  font-size: 0.9em;
  margin-left: 8px;
  opacity: 0.7;
  align-self: flex-end;
`;

class Catch extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { error: error };
  }

  componentDidCatch(error, errorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.error != null) {
      // You can render any custom fallback UI
      return this.props.fallback(this.state.error);
    }

    return this.props.children;
  }
}

const LEZER_GRAMMAR_EDITOR_ID = as_editor_id("lezer-grammar");
const JAVASCRIPT_EDITOR_ID = as_editor_id("javascript");
const WHAT_TO_PARSE_EDITOR_ID = as_editor_id("code-to-parse");

/** @param {{ project_name: string }} props */
let Editor = ({ project_name }) => {
  let main_scope = lezer_playground_storage.child(project_name);

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
          history: historyField.field,
        }
      );
      history = restored_state.field(historyField.field);
    } catch (error) {}

    return EditorInChief.create({
      editors: (editorstate) => ({
        "lezer-grammar": EditorState.create({
          doc: _parser_code,
          extensions: [
            editorstate.section_editor_extensions(LEZER_GRAMMAR_EDITOR_ID),
          ],
        }),
        javascript: EditorState.create({
          doc: javascript_stuff,
          extensions: [
            editorstate.section_editor_extensions(JAVASCRIPT_EDITOR_ID),
          ],
        }),
        "code-to-parse": EditorState.create({
          doc: code_to_parse,
          extensions: [
            editorstate.section_editor_extensions(WHAT_TO_PARSE_EDITOR_ID),
          ],
        }),
      }),
      extensions: [
        history != null ? historyField.init(() => history) : [],

        // This works so smooth omg
        [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
      ],
    });
  }, []);

  let [state, set_state] = React.useState(initial_state);
  let _set_state = React.useCallback(
    (/** @type {typeof state} */ new_state) => {
      set_state(new_state);
    },
    [set_state]
  );

  let viewupdate = useViewUpdate(state, _set_state);

  let lezer_grammar_viewupdate = extract_nested_viewupdate(
    viewupdate,
    LEZER_GRAMMAR_EDITOR_ID
  );
  let code_to_parse_viewupdate = extract_nested_viewupdate(
    viewupdate,
    WHAT_TO_PARSE_EDITOR_ID
  );
  let javascript_stuff_viewupdate = extract_nested_viewupdate(
    viewupdate,
    JAVASCRIPT_EDITOR_ID
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
  useCodemirrorKeyhandler(viewupdate);

  React.useEffect(() => {
    let serialized = state.toJSON({
      history: historyField,
    });
    main_scope.child("history").set(serialized.history);
  }, [state]);

  let parser_code = lezer_grammar_viewupdate.state.doc.toString();

  let { generated_parser_code, generated_parser_time } = useLezerCompiled({
    do_run,
    parser_code,
  });

  let { javascript_result } = useJavascriptResult({
    do_run,
    generated_parser_code,
    javascript_stuff,
  });

  let { parser_not_configured } = useLezerInstantiated({
    do_run,
    generated_parser_code,
    javascript_result,
  });

  // let generated_parser_code = new Failure(new Error("Not implemented"));
  // let generated_parser_time = new Failure(new Error("Not implemented"));
  // let parser_not_configured = new Failure(new Error("Not implemented"));
  // let javascript_result = new Failure(new Error("Not implemented"));

  let [dialect, set_dialect] = useSearchParamState("dialect");

  // let [dialect, set_dialect] = React.useState(
  //   /** @type {string | undefined} */ (undefined)
  // );

  let parser = React.useMemo(
    () =>
      parser_not_configured.map((x) =>
        x.configure({
          dialect: dialect,
        })
      ),
    [parser_not_configured, dialect]
  );

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

  // Add a class to the body whenever the cmd is held down
  React.useEffect(() => {
    let key_i_m_looking_for = /Mac/.test(navigator.platform)
      ? "Meta"
      : "Control";
    let mouse_down_listener = (event) => {
      if (event.key === key_i_m_looking_for) {
        document.body.classList.add("cmd-down");
      }
    };
    let mouse_up_listener = (event) => {
      if (event.key === key_i_m_looking_for) {
        document.body.classList.remove("cmd-down");
      }
    };
    document.addEventListener("keydown", mouse_down_listener);
    document.addEventListener("keyup", mouse_up_listener);
    return () => {
      document.removeEventListener("keydown", mouse_down_listener);
      document.removeEventListener("keyup", mouse_up_listener);
    };
  }, []);

  let onSelection = React.useCallback(
    (/** @type {readonly [Number, number]} */ [from, to]) => {
      // @ts-ignore
      code_to_parse_viewupdate.view.dispatch({
        selection: { anchor: to, head: from },
        effects: [
          ScrollIntoViewButOnlyTheEditorEffect.of({
            position: from,
          }),
        ],
      });
    },
    [code_to_parse_viewupdate.view.dispatch]
  );

  return (
    <AppScroller>
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
              {generated_parser_time
                .map((time) => <Runtime>{round(time / 1000, 2)}s</Runtime>)
                .or(null)}
              <div style={{ flex: 1 }} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                }}
                title="Compile and run the grammar:
                this mainly exists because the parser might get into an infinite loop,
                and reloading the page afterwards will then toggle this checkbox so you can fix the error."
              >
                <span style={{ opacity: 0.5 }}>run</span>
                <div style={{ width: 8 }} />
                <input
                  style={{
                    margin: 0,
                    accentColor: "#cb00d7",
                    opacity: 0.5,
                  }}
                  type="checkbox"
                  checked={do_run}
                  onChange={(e) => {
                    set_do_run(e.target.checked);
                  }}
                />
              </div>
            </div>
          }
        >
          <LezerEditor
            error={
              generated_parser_code instanceof Failure
                ? generated_parser_code.value
                : null
            }
            viewupdate={lezer_grammar_viewupdate}
            result={parser}
          />
        </Pane>

        <Pane
          style={{
            gridArea: "what-to-parse-editor",
            backgroundColor: "#0a0a0a",
          }}
          header={
            <>
              <span>demo text</span>
              <div style={{ minWidth: 8 }} />
              <div style={{ flex: 1 }} />

              {parser_in_betweens instanceof Success &&
              // @ts-ignore
              !isEmpty(parser_in_betweens.get().dialects) ? (
                <>
                  <span>dialect</span>
                  <div style={{ minWidth: 8 }} />
                  <PaneSelect
                    value={dialect}
                    onChange={(e) => {
                      console.log(`e.target.value:`, e.target.value);
                      set_dialect(
                        e.target.value === "" ? undefined : e.target.value
                      );
                    }}
                    style={{
                      opacity: dialect === undefined ? 0.5 : 1,
                    }}
                  >
                    <option value="">default</option>
                    {parser instanceof Success
                      ? // @ts-ignore
                        Object.keys(parser.get().dialects).map((dialect) => (
                          <option value={dialect}>{dialect}</option>
                        ))
                      : null}
                  </PaneSelect>
                </>
              ) : null}
            </>
          }
        >
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
        </Pane>

        <Pane
          style={{ gridArea: "parsed-result", backgroundColor: "#001107" }}
          header={
            <>
              <span>lezer result tree</span>
            </>
          }
        >
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
              <Catch
                fallback={() => (
                  <FillAndCenter>
                    <pre style={{ color: "#ff00004d" }}>
                      The results view crashed!
                    </pre>
                  </FillAndCenter>
                )}
              >
                <ParsedResultEditor
                  code_to_parse_viewupdate={code_to_parse_viewupdate}
                  parser={parser_in_betweens.value}
                  code_to_parse={code_to_parse}
                  onSelection={onSelection}
                />
              </Catch>
            ) : parser_in_betweens instanceof Failure &&
              parser instanceof Failure ? (
              generated_parser_code instanceof Failure ? (
                <LezerErrorEditor error={generated_parser_code.value} />
              ) : (
                <FillAndCenter>
                  <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
                    {parser_in_betweens.value.toString()}
                  </pre>
                </FillAndCenter>
              )
            ) : (
              <FillAndCenter>
                <pre style={{ color: "#ffff004d" }}>
                  Waiting for{"\n"}parser to compile..
                </pre>
              </FillAndCenter>
            )}
          </React.Suspense>
        </Pane>

        <Pane
          style={{ gridArea: "javascript-stuff", backgroundColor: "#180000" }}
          header={<PaneTab title="javascript stuff" process={js_stuff} />}
        >
          <JavascriptStuffEditor
            error={
              javascript_result instanceof Failure
                ? javascript_result.value
                : null
            }
            viewupdate={javascript_stuff_viewupdate}
          />
        </Pane>

        <div
          style={{
            gridArea: "█",
            backgroundColor: "black",
          }}
        />

        <div
          style={{
            gridArea: "header",
          }}
        >
          <AppHeader main_scope={main_scope} />
        </div>
      </AppGrid>
    </AppScroller>
  );
};
