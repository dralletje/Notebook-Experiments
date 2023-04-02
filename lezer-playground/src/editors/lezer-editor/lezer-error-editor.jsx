import React from "react";
import {
  HighlightStyle,
  LRLanguage,
  LanguageSupport,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { parser as lezer_error_parser } from "@dral/lezer-lezer-error";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { base_extensions } from "../shared.js";
import { CodeMirror } from "codemirror-x-react";

const syntax_colors = syntaxHighlighting(
  HighlightStyle.define(
    [
      { tag: t.name, color: "#b10000" },
      { tag: t.propertyName, color: "#ff0000", fontWeight: "bold" },
      { tag: t.atom, color: "#ffffff", fontWeight: 700 },
      { tag: t.self, color: "#ffffff", fontWeight: 700 },

      { tag: t.literal, color: "#99ad00" },
      { tag: t.moduleKeyword, color: "white", fontWeight: "bold" },
    ],
    { all: { color: "#5f0000" } }
  )
);

let lezer_error_lang = new LanguageSupport(
  LRLanguage.define({
    // @ts-ignore
    parser: lezer_error_parser,
  })
);

let extension_for_error = (error_message) => {
  console.log(`error_message:`, error_message);
  if (error_message.startsWith("shift/reduce conflict between")) {
    console.log("SHIFT REDUCE");
    return [
      EditorView.theme({
        "&": {
          color: "red",
        },
      }),
    ];
  } else {
    return [
      EditorView.theme({
        "&": {
          color: "red",
        },
      }),
    ];
  }
};

export let LezerErrorEditor = ({ error }) => {
  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc: error.message,
      extensions: [
        base_extensions,
        extension_for_error(error.message),
        lezer_error_lang,
        syntax_colors,
      ],
    });
  }, [error.message]);

  return <CodeMirror state={initial_editor_state} />;
};
