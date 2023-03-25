import React from "react";
import styled from "styled-components";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  keymap,
  placeholder,
  ViewPlugin,
} from "@codemirror/view";
import { bracketMatching } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

import {
  Extension,
  useViewUpdate,
  CodemirrorThatUsesViewUpdate,
} from "codemirror-x-react";
import { awesome_line_wrapping } from "codemirror-awesome-line-wrapping";

import { lezer_syntax_extensions } from "./editors/lezer-editor.js";
import { dot_gutter } from "./codemirror-dot-gutter.jsx";
import {
  DEFAULT_JAVASCRIPT_STUFF,
  DEFAULT_PARSER_CODE,
  DEFAULT_TO_PARSE,
} from "./default-field-codes.js";

import "./App.css";

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

let log_me_view = ViewPlugin.define(() => {
  console.log("ENTER");
  return {
    update: (update) => {},
    destroy: () => {
      console.log("EXEUNT");
    },
  };
});

/** @param {{ viewupdate: import("codemirror-x-react").GenericViewUpdate }} props */
export let LezerEditor = ({ viewupdate }) => {
  return (
    <CodemirrorThatUsesViewUpdate viewupdate={viewupdate}>
      <Extension extension={base_extensions} />
      <Extension extension={lezer_syntax_extensions} />
      <Extension extension={awesome_line_wrapping} />
      <Extension extension={log_me_view} />
    </CodemirrorThatUsesViewUpdate>
  );
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

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

export let App = ({}) => {
  let initial_state = React.useMemo(() => {
    return EditorState.create({
      doc: "@top AwesomeProgram { Value }\n",
      extensions: [],
    });
  }, []);
  let [state, set_state] = React.useState(initial_state);

  let viewupdate = useViewUpdate(state, set_state);

  // console.log(`viewupdate:`, viewupdate);

  return (
    <AppGrid>
      <Pane
        style={{ backgroundColor: "#010539", width: 400, height: 300 }}
        header={<span>lezer grammar</span>}
      >
        <GeneralEditorStyles>
          <LezerEditor viewupdate={viewupdate} />
        </GeneralEditorStyles>
      </Pane>
    </AppGrid>
  );
};
