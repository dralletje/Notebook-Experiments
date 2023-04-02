import { LRLanguage, LanguageSupport } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import {
  MaxIdentationSpacesFacet,
  awesome_line_wrapping,
} from "codemirror-awesome-line-wrapping";
import { Extension } from "codemirror-x-react";
import { CodemirrorFromViewUpdate } from "codemirror-x-react/viewupdate.js";
import React from "react";
import { base_extensions } from "../shared.js";
import { StateEffect } from "@codemirror/state";

let what_to_parse_theme = [
  EditorView.theme({
    ".cm-selectionMatch": {
      "text-shadow": "0 0 13px rgb(255 255 255 / 70%) !important",
    },
  }),
];

let dont_space_too_much = MaxIdentationSpacesFacet.of(10);

let NO_EXTENSIONS = [];

/**
 * @param {{
 *  viewupdate: import("codemirror-x-react/viewupdate.js").GenericViewUpdate,
 *  parser: import("@lezer/lr").LRParser | null,
 *  js_stuff: import("../../use/OperationMonadBullshit.js").ExecutionResult<{
 *    extensions: import("@codemirror/state").Extension[],
 *  }>
 * }} props
 */
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
