import { lezerLanguage } from "@codemirror/lang-lezer";
import { Decoration, EditorView } from "@codemirror/view";
import {
  HighlightStyle,
  LanguageSupport,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { StateField, Text } from "@codemirror/state";
import { partition, update } from "lodash";
import { Tree, TreeCursor } from "@lezer/common";
import { iterate_over_cursor } from "dral-lezer-helpers";

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
  ".boring": {
    color: "#947eff",
  },
  ".very-important": {
    color: "#b6b6b6",
    fontWeight: 700,
  },
  ".important": {
    color: "#947eff",
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

export let lezer_extension = new LanguageSupport(
  lezerLanguage.configure({
    props: [lezerStyleTags],
  })
);
export let lezer_highlight = syntaxHighlighting(
  HighlightStyle.define(
    [
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
      { tag: t.paren, class: "very-important" },
      { tag: t.squareBracket, class: "boring" },
      { tag: t.brace, class: "boring" },
      // ~ * ? | +
      { tag: t.operator, class: "very-important" },
      // ~name
      { tag: t.name, class: "very-important" },

      { tag: t.labelName, class: "property" },
      { tag: t.function(t.variableName), class: "variable" },

      { tag: t.propertyName, class: "property" },
      { tag: t.className, class: "property" },
      { tag: t.modifier, class: "very-important" },
      { tag: t.punctuation, class: "boring" },
    ],
    {
      all: "boring",
    }
  )
);

/**
 * @param {Text} doc
 * @param {TreeCursor} cursor
 * @returns {{
 *  definitions: { [name: string]: Array<{ position: [number, number] }> },
 *  references: Array<{ position: [number, number], name: string, definition: { position: [number, number] } }>,
 *  unresolved: Array<{ position: [number, number], name: string }>,
 * }}
 */
let scope_from_cursor = (doc, cursor) => {
  let definitions =
    /** @type {ReturnType<scope_from_cursor>["definitions"]} */ ({});
  let unresolveds =
    /** @type {ReturnType<scope_from_cursor>["unresolved"]} */ ([]);
  let references =
    /** @type {ReturnType<scope_from_cursor>["references"]} */ ([]);

  iterate_over_cursor({
    cursor,
    enter: (cursor) => {
      if (cursor.name === "RuleName") {
        let name = doc.sliceString(cursor.from, cursor.to);
        unresolveds.push({
          position: [cursor.from, cursor.to],
          name,
        });
      }

      if (cursor.name === "InlineRule") {
        if (cursor.firstChild()) {
          try {
            do {
              // @ts-expect-error
              if (cursor.name === "Body") {
                // TODO Parameters
                let subscope = scope_from_cursor(doc, cursor);
                // TODO Add resolved references
                unresolveds.push(...subscope.unresolved);
                return false;
              }
            } while (cursor.nextSibling());
          } finally {
            cursor.parent();
          }
        }
      }

      if (cursor.name === "RuleDeclaration") {
        if (cursor.firstChild()) {
          let local_definitions = {};
          try {
            do {
              // @ts-expect-error
              if (cursor.name === "RuleName") {
                let name = doc.sliceString(cursor.from, cursor.to);
                definitions[name] ??= [];
                definitions[name].push({
                  position: [cursor.from, cursor.to],
                });
              }

              // @ts-expect-error
              if (cursor.name === "ParamList") {
                if (cursor.firstChild()) {
                  try {
                    do {
                      if (cursor.name === "Name") {
                        let name = doc.sliceString(cursor.from, cursor.to);
                        // TODO Pick up name defined multiple times?
                        local_definitions[name] = {
                          position: [cursor.from, cursor.to],
                        };
                      }
                    } while (cursor.nextSibling());
                  } finally {
                    cursor.parent();
                  }
                }
              }

              // @ts-expect-error
              if (cursor.name === "Body") {
                // TODO Parameters
                let subscope = scope_from_cursor(doc, cursor);
                for (let reference of subscope.references) {
                  references.push(reference);
                }
                for (let unresolved of subscope.unresolved) {
                  if (local_definitions[unresolved.name]) {
                    references.push({
                      position: unresolved.position,
                      name: unresolved.name,
                      definition: local_definitions[unresolved.name],
                    });
                  } else {
                    unresolveds.push(unresolved);
                  }
                }
              }
            } while (cursor.nextSibling());
          } finally {
            cursor.parent();
          }
          return false;
        }
      }
    },
  });

  let result = /** @type {ReturnType<scope_from_cursor>} */ ({
    definitions: {},
    references: [],
    unresolved: [],
  });
  for (let unresolved of unresolveds) {
    let definition = definitions[unresolved.name];
    if (definition) {
      result.references.push({
        ...unresolved,
        definition: definition[0],
      });
    } else {
      result.unresolved.push(unresolved);
    }
  }
  return result;
};

let scope_field = StateField.define({
  create(state) {
    return scope_from_cursor(state.doc, syntaxTree(state).cursor());
  },
  update(value, tr) {
    if (tr.docChanged) {
      let state = tr.state;
      let value = scope_from_cursor(state.doc, syntaxTree(state).cursor());
      console.log(`value:`, value);
      return value;
    }
    return value;
  },
});

export let is_mac_keyboard = /Mac/.test(navigator.platform);
export let ctrl_or_cmd_name = is_mac_keyboard ? "Cmd" : "Ctrl";
export let has_ctrl_or_cmd_pressed = (event) =>
  event.ctrlKey || (is_mac_keyboard && event.metaKey);

let scope_decorations = EditorView.decorations.compute(
  [scope_field],
  (state) => {
    let scope = state.field(scope_field);
    let decorations = [];

    for (let reference of scope.references) {
      decorations.push(
        Decoration.mark({
          class: "reference",
          attributes: {
            title: `${ctrl_or_cmd_name}-Click to jump to the definition of ${reference.name}.`,
            "data-pluto-variable": reference.name,
            "data-definition-from": String(reference.definition.position[0]),
            "data-definition-to": String(reference.definition.position[1]),
            href: `#${reference.name}`,
          },
        }).range(reference.position[0], reference.position[1])
      );
    }

    return Decoration.set(decorations);
  }
);

let scope_event_handler = EditorView.domEventHandlers({
  pointerdown: (event, view) => {
    console.log(
      `as_ctrl_or_cmd_pressed(event):`,
      has_ctrl_or_cmd_pressed(event)
    );
    if (!has_ctrl_or_cmd_pressed(event)) return;
    if (event.button !== 0) return;
    if (!(event.target instanceof Element)) return;

    let pluto_variable = event.target.closest("[data-pluto-variable]");
    console.log(`pluto_variable:`, pluto_variable);
    if (!pluto_variable) return;

    let variable = pluto_variable.getAttribute("data-pluto-variable");
    if (variable == null) return;
    let from = pluto_variable.getAttribute("data-definition-from");
    let to = pluto_variable.getAttribute("data-definition-to");

    event.preventDefault();

    // let scope = view.state.field(scope_field);
    // let definition = scope.definitions[variable];
    // if (definition == null) return;

    view.dispatch({
      selection: {
        anchor: Number(from),
        head: Number(to),
      },
      scrollIntoView: true,
    });
  },
});

export let lezer_syntax_extensions = [
  scope_field,
  scope_decorations,
  scope_event_handler,

  lezer_extension,
  lezer_highlight,
  lezer_syntax_classes,
];
