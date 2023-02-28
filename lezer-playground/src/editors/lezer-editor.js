import { lezerLanguage } from "@codemirror/lang-lezer";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import {
  HighlightStyle,
  LanguageSupport,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { Prec, StateField, Text, EditorState } from "@codemirror/state";
import { Tree, TreeCursor } from "@lezer/common";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { LanguageStateField } from "@dral/codemirror-helpers";
import { acceptCompletion, autocompletion } from "@codemirror/autocomplete";
import { isEmpty } from "lodash-es";

let lezerStyleTags = styleTags({
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  '"!" ~ "*" + ? |': t.operator,
  "=": t.punctuation,

  LineComment: t.lineComment,
  BlockComment: t.blockComment,
  "from grammar as empty prop extend specialize": t.keyword,
  "@top @left @right @cut @external": t.modifier,
  "@precedence @tokens @context @dialects @skip @detectDelim @conflict @local tokens propSource @else":
    t.definitionKeyword,
  "@extend @specialize": t.operatorKeyword,
  "CharSet InvertedCharSet": t.regexp,

  AnyChar: t.character,
  Literal: t.string,
  CharClass: t.atom,

  RuleName: t.variableName,
  "RuleDeclaration/RuleName TokensBody/RuleName": t.definition(t.variableName),

  // Make inline rules look more like part of the syntax,
  // than references to separate rules (because they aren't)
  "InlineRule/RuleName": t.special(t.definition(t.variableName)),
  "InlineRule/Body/{ InlineRule/Body/}": t.special(t.brace),

  // Make names imported from javascript files show up as external properties
  Name: t.propertyName,

  "Call/RuleName": t.function(t.variableName),
  "ParamList/Name": t.variableName,

  PrecedenceName: t.className,
  "PrecedenceMarker!": t.className,

  "Props...": t.meta,
  "Prop/Literal Prop/Name": t.meta,

  "AmbiguityMarker!": t.modifier,
  // propSource: t.keyword,
});

let lezer_syntax_classes = EditorView.theme({
  // Default font color:
  ".cm-content": {
    color: "#655d8d",
  },

  // Repeated so specificity is increased...
  // I need this to show the colors in the selected autocomplete...
  // TODO Ideally I'd just do a custom render or something on the autocomplete
  ".boring.boring.boring": {
    color: "#655d8d",
  },
  ".very-important.very-important.very-important": {
    color: "#b6b6b6",
    fontWeight: 700,
  },
  ".important.important.important": {
    color: "#b6b6b6",
  },
  ".property.property.property": {
    color: "#cb00d7",
  },
  ".variable.variable.variable": {
    color: "#a16fff",
  },
  ".literal.literal.literal": {
    color: "#00a7ca",
  },
  ".comment.comment.comment": {
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
      { tag: t.meta, class: "boring" },

      { tag: t.character, class: "literal" },
      { tag: t.string, class: "literal" },
      { tag: t.keyword, class: "important" },
      { tag: t.modifier, class: "green" },
      { tag: t.definitionKeyword, class: "very-important" },
      { tag: t.operatorKeyword, class: "very-important" },
      { tag: t.regexp, class: "literal" },
      { tag: t.atom, class: "literal" },
      { tag: t.variableName, class: "variable" },
      { tag: t.definition(t.variableName), class: "variable" },
      {
        tag: t.special(t.definition(t.variableName)),
        class: "important",
      },
      { tag: t.name, class: "variable" },
      { tag: t.paren, class: "very-important" },
      { tag: t.squareBracket, class: "boring" },
      { tag: t.brace, class: "boring" },
      { tag: t.special(t.brace), class: "very-important" },
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
    ]
    // {
    //   all: "boring",
    // }
  )
);

// /**
//  * @param {Text} doc
//  * @param {Tree} tree
//  * @returns {any}
//  */
// let scope_from_tree_wasm = (doc, tree) => {
//   // console.log(`my_thing:`, my_thing);
//   // console.log(`tree:`, tree);
//   let result = my_thing(tree.children[0], 0);
//   console.log(`result:`, result);
// };

/**
 * @typedef DefinitionType
 * @type {"token" | "rule" | "local-token" | "external-token" | "precedence"}
 *
 * @typedef Scope
 * @type {{
 *  parent_scope: Scope?,
 *  child_scopes: Scope[],
 *  from: number,
 *  to: number,
 *  definitions: { [name: string]: Array<{ position: [number, number], type: DefinitionType }> },
 *  references: Array<{ position: [number, number], name: string, definition: { position: [number, number] }? }>,
 * }}
 *
 * @param {Text} doc
 * @param {TreeCursor} cursor
 * @returns {Scope}
 */
let scope_from_cursor = (doc, cursor) => {
  let definitions =
    /** @type {ReturnType<scope_from_cursor>["definitions"]} */ ({});
  let references =
    /** @type {ReturnType<scope_from_cursor>["references"]} */ ([]);

  // Already make the scope, so we can add it to subscopes
  let scope = /** @type {ReturnType<scope_from_cursor>} */ ({
    from: cursor.from,
    to: cursor.to,
    parent_scope: null,
    child_scopes: [],
    definitions: definitions,
    references: [],
    unresolved: [],
  });

  iterate_over_cursor({
    cursor,
    enter: (cursor) => {
      if (cursor.name === "PrecedenceBody") {
        iterate_over_cursor({
          cursor,
          enter: (cursor) => {
            if (cursor.name === "PrecedenceName") {
              let name = "!" + doc.sliceString(cursor.from, cursor.to);
              definitions[name] = definitions[name] || [];
              definitions[name].push({
                type: "precedence",
                position: [cursor.from, cursor.to],
              });
            }

            if (cursor.name === "RuleName") {
              // Reference to token
              let name = doc.sliceString(cursor.from, cursor.to);
              references.push({
                position: [cursor.from, cursor.to],
                name,
                definition: null,
              });
            }
          },
        });
        return false;
      }

      if (cursor.name === "PrecedenceMarker") {
        let name = doc.sliceString(cursor.from, cursor.to);
        references.push({
          position: [cursor.from, cursor.to],
          name,
          definition: null,
        });
      }

      if (cursor.name === "RuleName") {
        let name = doc.sliceString(cursor.from, cursor.to);
        references.push({
          position: [cursor.from, cursor.to],
          name,
          definition: null,
        });
      }

      if (
        cursor.name === "InlineRule" ||
        cursor.name === "ExternalSpecializeDeclaration"
      ) {
        if (cursor.firstChild()) {
          try {
            do {
              // @ts-expect-error
              if (cursor.name === "Body") {
                let subscope = scope_from_cursor(doc, cursor);

                // This scope will never have definitions.. right?
                if (!isEmpty(subscope.definitions)) {
                  console.log(`subscope.definitions:`, subscope.definitions);
                  scope.child_scopes.push(subscope);
                }

                // TODO Add resolved references
                references.push(...subscope.references);
                return false;
              }
            } while (cursor.nextSibling());
          } finally {
            cursor.parent();
          }
        }
      }

      // "Token" only happens inside `@external tokens`
      if (cursor.name === "Token") {
        if (cursor.firstChild()) {
          try {
            do {
              // @ts-expect-error
              if (cursor.name === "RuleName") {
                let name = doc.sliceString(cursor.from, cursor.to);
                definitions[name] = definitions[name] || [];
                definitions[name].push({
                  type: "external-token",
                  position: [cursor.from, cursor.to],
                });
              }
            } while (cursor.nextSibling());
          } finally {
            cursor.parent();
          }
        }
      }

      if (cursor.name === "RuleDeclaration") {
        if (cursor.firstChild()) {
          try {
            let local_definitions = {};
            let is_top = false;
            do {
              // @ts-expect-error
              if (cursor.name === "@top") {
                is_top = true;
              }

              // @ts-expect-error
              if (cursor.name === "RuleName") {
                // @top rules aren't actually definitions
                if (is_top) continue;

                let name = doc.sliceString(cursor.from, cursor.to);
                definitions[name] ??= [];
                definitions[name].push({
                  type: "rule",
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
                let subscope = {
                  ...scope_from_cursor(doc, cursor),
                  parent: scope,
                };

                if (!isEmpty(local_definitions)) {
                  scope.child_scopes.push(subscope);
                  subscope.definitions = {
                    ...subscope.definitions,
                    ...local_definitions,
                  };
                }

                for (let reference of subscope.references) {
                  if (reference.definition != null) {
                    references.push(reference);
                  } else if (local_definitions[reference.name]) {
                    references.push({
                      position: reference.position,
                      name: reference.name,
                      definition: local_definitions[reference.name],
                    });
                  } else {
                    references.push(reference);
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

      if (cursor.name === "ElseToken") {
        if (cursor.firstChild()) {
          try {
            do {
              // @ts-expect-error
              if (cursor.name === "RuleName") {
                let name = doc.sliceString(cursor.from, cursor.to);
                definitions[name] ??= [];
                definitions[name].push({
                  type: "local-token",
                  position: [cursor.from, cursor.to],
                });
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

  for (let reference of references) {
    let definition = reference.definition ?? definitions[reference.name]?.[0];

    if (definition) {
      scope.references.push({
        ...reference,
        definition: definition,
      });
    } else {
      scope.references.push(reference);
    }
  }
  return scope;
};

let scope_field = StateField.define({
  create(state) {
    return scope_from_cursor(state.doc, syntaxTree(state).cursor());
  },
  update(value, tr) {
    // console.time("Scope from WASM");
    // let result = scope_from_tree_wasm(tr.state.doc, syntaxTree(tr.state));
    // console.timeEnd("Scope from WASM");

    if (
      tr.docChanged ||
      tr.state.field(LanguageStateField) !==
        tr.startState.field(LanguageStateField, false)
    ) {
      let state = tr.state;
      console.time("Scope from cursor");
      let value = scope_from_cursor(state.doc, syntaxTree(state).cursor());
      console.timeEnd("Scope from cursor");
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
      if (reference.definition != null) {
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
      } else {
        decorations.push(
          Decoration.mark({
            class: "undefined",
          }).range(reference.position[0], reference.position[1])
        );
      }
    }

    return Decoration.set(decorations, false);
  }
);

let local_variable_decorations = [
  EditorView.theme({
    ".local-variable, .local-variable *": {
      color: "#cb8fff !important",
      "font-weight": "bold",
    },
  }),
  EditorView.decorations.compute([scope_field], (state) => {
    let scope = state.field(scope_field);
    let decorations = [];

    for (let subscope of scope.child_scopes) {
      for (let definition of Object.values(subscope.definitions).flat()) {
        decorations.push(
          Decoration.mark({
            class: "local-variable",
          }).range(definition.position[0], definition.position[1])
        );
      }
      for (let reference of subscope.references) {
        if (reference.name in subscope.definitions) {
          decorations.push(
            Decoration.mark({
              class: "local-variable",
            }).range(reference.position[0], reference.position[1])
          );
        }
      }
    }

    return Decoration.set(decorations, true);
  }),
];

let unused_variable_decorations = [
  EditorView.theme({
    ".unused-variable": {
      opacity: "0.5",
    },
  }),
  EditorView.decorations.compute([scope_field], (state) => {
    let scope = state.field(scope_field);
    let decorations = [];

    definition_loop: for (let name of Object.keys(scope.definitions)) {
      for (let reference of scope.references) {
        if (reference.name === name) {
          continue definition_loop;
        }
      }

      for (let definition of scope.definitions[name]) {
        decorations.push(
          Decoration.mark({
            class: "unused-variable",
          }).range(definition.position[0], definition.position[1])
        );
      }
    }

    return Decoration.set(decorations, true);
  }),
];

let scope_event_handler = EditorView.domEventHandlers({
  pointerdown: (event, view) => {
    if (!has_ctrl_or_cmd_pressed(event)) return;
    if (event.button !== 0) return;
    if (!(event.target instanceof Element)) return;

    let pluto_variable = event.target.closest("[data-pluto-variable]");
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

let scope_style = EditorView.theme({
  "[data-pluto-variable]": {
    "--variable-color": "#ff00a8",
  },
  ".cmd-down & [data-pluto-variable]": {
    cursor: "pointer",
    "text-decoration": "underline 2px #ffffff40",
    "text-underline-offset": "3px",
    "text-decoration-skip-ink": "none",
  },
  ".cmd-down & [data-pluto-variable]:hover": {
    cursor: "pointer",
    // "font-weight": "bold",
    "text-decoration": "underline 2px var(--variable-color)",
    "text-underline-offset": "3px",
    "text-decoration-skip-ink": "none",
  },
  ".cmd-down & [data-pluto-variable]:hover *": {
    color: "var(--variable-color)",
  },
});

let theme = EditorView.theme(
  {
    "& .cm-selectionBackground": {
      background: "rgb(74 0 88 / 56%) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      background: "rgb(130 0 153 / 56%) !important",
    },
    "&.cm-editor .cm-selectionMatch": {
      "text-shadow": "0 0 13px rgb(255 7 7)",
    },
    ".cm-searchMatch": {
      "background-color": "#4800568a",
    },
    ".cm-searchMatch-selected": {
      "background-color": "#ff00ff8a",
    },
  },
  {
    dark: true,
  }
);

/** @type {import("@codemirror/autocomplete").CompletionSource} */
const body_provider = (ctx) => {
  let scope = ctx.state.field(scope_field);

  let tokens_declration_token = ctx.tokenBefore(["TokensDeclaration"]);

  let body_token = ctx.tokenBefore(["Body", "Props"]);
  if (body_token?.type.name !== "Body") return null;

  let token =
    ctx.tokenBefore(["RuleName", "PrecedenceMarker"]) ??
    (ctx.explicit ? { from: ctx.pos, to: ctx.pos } : null);
  if (token == null) return null;

  /** @type {import("@codemirror/autocomplete").Completion[]} */
  let collected_options = [];

  /** @type {Scope?} */
  let current_scope = scope;
  let scope_counter = 0;
  while (current_scope) {
    for (let [name, meta] of Object.entries(current_scope.definitions)) {
      let is_precedence = name.startsWith("!");

      // Don't show !precedence in tokens where they are not allowed
      // TODO Only show token names? (now it shows all names, which only token names are allowed in tokens)
      if (is_precedence && tokens_declration_token != null) continue;

      collected_options.push({
        label: name,
        type: is_precedence
          ? "property"
          : scope_counter > 0
          ? "local-variable"
          : "variable",
        boost: scope_counter,
      });
    }

    scope_counter++;
    current_scope =
      current_scope.child_scopes.find(
        (scope) => scope.from <= ctx.pos && ctx.pos <= scope.to
      ) ?? null;
  }

  return {
    from: token.from,
    to: token.to,
    options: collected_options,
  };
};

let charclasses = [
  "@asciiLetter",
  "@asciiUpperCase",
  "@asciiLowerCase",
  "@digit",
  "@whitespace",
  "@eof",
];

/** @type {import("@codemirror/autocomplete").CompletionSource} */
const charclass_provider = (ctx) => {
  // Let us be inside a Body inside a TokensDeclaration
  if (ctx.tokenBefore(["TokensDeclaration"]) == null) return null;
  if (ctx.tokenBefore(["Body"]) == null) return null;

  let current_token =
    ctx.matchBefore(/@\w*/) ??
    (ctx.explicit
      ? {
          from: ctx.pos,
          to: ctx.pos,
        }
      : null);

  if (current_token == null) return null;

  return {
    from: current_token.from,
    to: current_token.to,
    options: charclasses.map((x) => ({ label: x, type: "literal", boost: 2 })),
  };
};

/** @type {import("@codemirror/autocomplete").CompletionSource} */
const pseudo_prop_provider = (ctx) => {
  let body_token = ctx.tokenBefore(["Props"]);
  if (body_token == null) return null;

  let token =
    ctx.tokenBefore(["AtName"]) ??
    ctx.matchBefore(/@/) ??
    (ctx.explicit ? { from: ctx.pos, to: ctx.pos } : null);
  if (token == null) return null;

  let options = [
    { label: "@isGroup", type: "property" },
    { label: "@name", type: "property" },
    { label: "@dialect", type: "property" },
    { label: "@export", type: "property" },
  ];

  return {
    from: token.from,
    to: token.to,
    options: options,
  };
};

export let lezer_syntax_extensions = [
  scope_field,
  scope_decorations,
  local_variable_decorations,
  unused_variable_decorations,
  scope_event_handler,
  scope_style,

  // Trying to add completions to the languageData...
  // but I have to cache stuff or else it will keep calling this in a loop D:
  // very frustrating!!
  // EditorState.languageData.compute([scope_field], (state) => {
  //   let last_pos = null;
  //   let last_completions = null;
  //   return (state, pos) => {
  //     if (last_pos !== pos) {
  //       last_pos = pos;
  //       last_completions = [
  //         {
  //           autocomplete: ["Pre"],
  //         },
  //       ];
  //     }
  //     return last_completions;
  //   };
  // }),

  autocompletion({
    activateOnTyping: true,
    closeOnBlur: false,
    icons: false,
    optionClass: (x) => x.type ?? "",
    override: [body_provider, pseudo_prop_provider, charclass_provider],
  }),
  Prec.highest(
    keymap.of([
      {
        key: "Tab",
        run: acceptCompletion,
      },
    ])
  ),
  EditorView.theme({
    ".cm-tooltip.cm-tooltip-autocomplete": {
      "background-color": "#000000",
      "border-radius": "9px",
      transform: "translateY(10px) translateX(-7px)",
      overflow: "hidden",

      "& .cm-completionMatchedText": {
        "text-decoration": "none",
        "font-weight": "bold",
      },
      "& > ul": {
        "font-family": "inherit",

        "& > li": {
          "padding-left": "8px",

          "&:first-child": {
            "padding-top": "4px",
          },
          "&:last-child": {
            "padding-bottom": "4px",
          },
          "&[aria-selected]": {
            background: "#ffffff2b",
            // filter: "brightness(1.5)",
          },
        },
      },
    },
  }),

  theme,

  lezer_extension,
  lezer_highlight,
  lezer_syntax_classes,

  EditorState.languageData.of((state, pos, side) => {
    return [{ wordChars: "~!@" }];
  }),
];
