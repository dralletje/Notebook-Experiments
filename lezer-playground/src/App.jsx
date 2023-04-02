import React from "react";
import styled from "styled-components";
import { EditorState, StateEffect } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { IoBonfire, IoHeart, IoLogoGithub } from "react-icons/io5";

import { CodeMirror, Extension } from "codemirror-x-react";
import {
  useViewUpdate,
  CodemirrorFromViewUpdate,
} from "codemirror-x-react/viewupdate";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";
import { LezerGeneratorWorker } from "@dral/lezer-generator-worker/lezer-generator-worker.js";
import { TransformJavascriptWorker } from "@dral/dralbook-transform-javascript/worker/transform-javascript-worker.js";
import { WhatToParseEditor } from "./editors/what-to-parse-editor/what-to-parse-editor";

////////////////////
import { ScrollIntoViewButOnlyTheEditorEffect } from "./should-be-shared/ScrollIntoViewButOnlyTheEditor";
////////////////////

import { ParsedResultEditor } from "./editors/parsed-result-editor/parsed-result-editor";
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
import { useCodemirrorKeyhandler } from "../../simple-notebooks/web-app/src/use/use-codemirror-keyhandler";
import { JavascriptStuffEditor } from "./editors/javascript-editor/javascript-editor";
import { LezerEditor } from "./editors/lezer-editor/lezer-editor";

import { compact, isEmpty, round } from "lodash-es";
import {
  create_nested_editor_state,
  EditorInChief,
  EditorInChiefKeymap,
  extract_nested_viewupdate,
} from "./should-be-shared/codemirror-editor-in-chief/editor-in-chief";
import {
  shared_history,
  historyKeymap,
  historyField,
} from "./should-be-shared/codemirror-editor-in-chief/codemirror-shared-history";
import { lezerLanguage } from "@codemirror/lang-lezer";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { LezerErrorEditor } from "./editors/lezer-editor/lezer-error-editor";
import { AppHeader } from "./Header.jsx";
import {
  useJavascriptResult,
  useLezerCompiled,
  useLezerInstantiated,
} from "./ugh/run-whole-compilation-pipeline.js";
import { useSearchParamState, useUrl } from "./use/use-url.js";
import { WhatToParseEditorWithErrorBoundary } from "./editors/what-to-parse-editor/what-to-parse-editor-with-error-boundary.jsx";

/**
 * @template T
 * @typedef ExecutionResult
 * @type {import("./use/OperationMonadBullshit.js").ExecutionResult<T>}
 */

let ThingFromCodemirroPlutoStyleGetRidOfThis = styled.div`
  display: contents;

  & .cm-editor .cm-content,
  & .cm-editor .cm-scroller,
  & .cm-editor .cm-tooltip-autocomplete .cm-completionLabel {
    font-family: inherit;
  }

  &:focus-within .cm-editor .cm-matchingBracket {
    color: var(--cm-matchingBracket-color) !important;
    font-weight: 700;
    background-color: var(--cm-matchingBracket-bg-color);
    border-radius: 2px;
  }

  & .cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li {
    height: unset;
  }

  & .cm-editor .cm-selectionBackground {
    background: var(--cm-selection-background-blurred);
  }
  & .cm-editor.cm-focused .cm-selectionBackground {
    background: var(--cm-selection-background);
  }

  & .cm-editor {
    color: var(--cm-editor-text-color);
  }
  & .cm-editor.cm-focused:not(.__) {
    outline: unset;
  }

  & .cm-selectionMatch {
    background: none !important;
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
  }
  @media (prefers-color-scheme: dark) {
    & .cm-selectionMatch {
      background: none !important;
      text-shadow: 0 0 13px rgb(255 255 255);
    }
  }

  & .cm-editor .cm-matchingBracket,
  & .cm-editor .cm-nonmatchingBracket {
    background-color: unset;
    color: unset;
  }

  & .cm-editor .cm-placeholder {
    color: var(--cm-placeholder-text-color);
    font-style: italic;
  }

  /* HEYYYYY */
  & .cm-editor {
    height: 100%;
  }

  & .cm-cursor {
    border-left-color: #dcdcdc !important;
  }
`;

let GeneralEditorStyles = styled.div`
  height: 100%;
  font-family: var(--mono-font-family);

  & .cm-scroller {
    /* padding-left: 16px; */
  }
  & .cm-content {
    padding-top: 8px;
    padding-bottom: 8px;
    padding-right: 16px;
    min-height: 100%;
  }
`;

let PaneHeader = styled.div`
  padding-top: 4px;
  padding-bottom: 4px;
  padding-left: 18px;
  padding-right: 5px;
  font-weight: bold;
  font-size: 12px;

  background-color: #ffffff17;
  color: #ffffff75;

  display: flex;
  flex-direction: row;
  align-items: center;

  user-select: none;
`;

// let NOISE_BACKGROUND = new URL(
//   "./noise-backgrounds/asfalt-light.png",
//   import.meta.url
// ).href;
// let NOISE_BACKGROUND =
//   "data:image/png;base64,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";

// Thanks, https://www.cssmatic.com/noise-texture,
// opacity=8%, density=26%, color=white, dimensions=100x100
let NOISE_BACKGROUND = new URL(
  "./noise-backgrounds/img-noise-100x100.png",
  import.meta.url
).href;

let PaneStyle = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 4px;

  ${PaneHeader}, .cm-panels {
    background-size: 100px 100px;
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
    background-size: 100px 100px;
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

    ${PaneStyle} {
      scroll-snap-align: center;
    }
  }
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
  let [url] = useUrl();
  let path = url.pathname;

  return (
    <ThingFromCodemirroPlutoStyleGetRidOfThis>
      <Editor project_name={path} />
    </ThingFromCodemirroPlutoStyleGetRidOfThis>
  );
};

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

/** @type {import("./should-be-shared/codemirror-editor-in-chief/logic.js").EditorId} */
// @ts-ignore
let LEZER_GRAMMAR_EDITOR_ID = "lezer-grammar";

/** @type {import("./should-be-shared/codemirror-editor-in-chief/logic.js").EditorId} */
// @ts-ignore
let JAVASCRIPT_EDITOR_ID = "javascript";

/** @type {import("./should-be-shared/codemirror-editor-in-chief/logic.js").EditorId} */
// @ts-ignore
let WHAT_TO_PARSE_EDITOR_ID = "code-to-parse";

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
        [LEZER_GRAMMAR_EDITOR_ID]: create_nested_editor_state({
          parent: editorstate.editorstate,
          editor_id: LEZER_GRAMMAR_EDITOR_ID,
          doc: _parser_code,
        }),
        [JAVASCRIPT_EDITOR_ID]: create_nested_editor_state({
          parent: editorstate.editorstate,
          editor_id: JAVASCRIPT_EDITOR_ID,
          doc: javascript_stuff,
        }),
        [WHAT_TO_PARSE_EDITOR_ID]: create_nested_editor_state({
          parent: editorstate.editorstate,
          editor_id: WHAT_TO_PARSE_EDITOR_ID,
          doc: code_to_parse,
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

  let viewupdate = useViewUpdate(state, set_state);

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

  // Add a class to the body whenever the mouse is held down
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
          style={{
            gridArea: "what-to-parse-editor",
            backgroundColor: "#0a0a0a",
          }}
          header={
            <>
              <span>demo text</span>
              <div style={{ minWidth: 8 }} />
              {/* <LoadingRingThing /> */}
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
          </GeneralEditorStyles>
        </Pane>

        <Pane
          style={{ gridArea: "javascript-stuff", backgroundColor: "#180000" }}
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

let Runtime = styled.div`
  font-size: 0.9em;
  margin-left: 8px;
  opacity: 0.7;
  align-self: flex-end;
`;
