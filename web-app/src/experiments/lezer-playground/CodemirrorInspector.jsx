import React from "react";
import { produce } from "immer";
import {
  EditorState,
  Facet,
  Prec,
  Range,
  RangeSetBuilder,
  RangeValue,
  StateEffect,
  StateEffectType,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  keymap,
  placeholder,
  ViewPlugin,
} from "@codemirror/view";
import {
  bracketMatching,
  codeFolding,
  HighlightStyle,
  LanguageSupport,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { search, searchKeymap } from "@codemirror/search";
import { defaultKeymap } from "@codemirror/commands";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";

import { CodeMirror, Extension } from "codemirror-x-react";
import { debug_syntax_plugin } from "codemirror-debug-syntax-plugin";
import { ReactWidget, useEditorView } from "react-codemirror-widget";

import { cursor_to_javascript } from "./cursor-to-javascript.js";
import { dot_gutter } from "./codemirror-dot-gutter.jsx";

let base_extensions = [
  EditorView.scrollMargins.of(() => ({ top: 32, bottom: 32 })),
  dot_gutter,
  EditorState.tabSize.of(2),
  placeholder("The rest is still unwritten..."),
  bracketMatching({}),
  // highlightSelectionMatches(),
  keymap.of(defaultKeymap),
  drawSelection({ cursorBlinkRate: 0 }),

  search({
    caseSensitive: false,
    top: true,
  }),
  keymap.of(searchKeymap),
];

/** @type {Array<import("@codemirror/state").Extension>} */
let NO_EXTENSIONS = [];

let Decorate_New_Error = Prec.highest(
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "NewExpression") {
      mutable_decorations.push(
        Decoration.mark({ class: "error" }).range(cursor.from, cursor.to)
      );
    }
  })
);

let lezer_result_syntax_classes = EditorView.theme({
  ".very-important": { color: "#ffb4fb", fontWeight: 700 },
  ".important": { color: "#ffb4fb" },
  ".boring": { color: "#2c402d" },
  ".property": { color: "#cb00d7" },
  ".variable": { color: "#0d6801" },
  ".literal": { color: "#00c66d" },
  ".comment": { color: "#747474", fontStyle: "italic" },
  ".error": { color: "#860101", fontStyle: "italic" },
});

let fold_style = EditorView.theme({
  ".fold-me-daddy:not(.folded)": {
    cursor: "pointer",
    "&:hover": {
      "text-decoration": "underline",
      "text-decoration-thickness": "3px",
    },
  },
  ".folded": {
    // color: "#0d6801",
    opacity: "0.5",
    cursor: "pointer",
  },
  ".ellipsis": {
    "font-weight": "bold",
    color: "#8b8b8b",
  },
});

/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
import { SingleEventEmitter } from "single-event-emitter";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { DecorationsFromTree } from "@dral/dral-codemirror-helpers";
/**
 * @typedef TreePosition
 * @type {number[]}
 */
/** @type {SingleEventEmitter<TreePosition | null>} */
let open_specific_node_emitter = new SingleEventEmitter();
/**
 * @param {import("@lezer/common").TreeCursor} cursor
 * @param {[number, number]} position
 */
let cursor_to_tree_position = (cursor, [from, to]) => {
  // if (from !== to) {
  //   to = to + 1;
  // }
  let positions = [];
  parent: do {
    let index = 0;
    do {
      if (cursor.from <= from && to <= cursor.to) {
        // Very hacky way to make sure that if we are at the end of a node,
        // and there is no next node right next to it,
        // we want to select that node.
        // HOWEVER, if there
        if (cursor.to === to) {
          if (cursor.nextSibling()) {
            if (cursor.from === to && from === to) {
              positions.push(index + 1);
              continue parent;
            } else {
              cursor.prevSibling();
              positions.push(index);
              continue parent;
            }
          } else {
            positions.push(index);
            continue parent;
          }
        }

        positions.push(index);
        continue parent;
      }
      index++;
    } while (cursor.nextSibling());
    // throw new Error("Can't find position in tree");
    break;
  } while (cursor.firstChild());
  return positions;
};
/**
 * @param {import("@lezer/common").TreeCursor} cursor
 * @param {TreePosition} position
 * @return {[number, number][]}
 */
let tree_position_to_cursor = (cursor, position) => {
  if (position.length === 0) {
    // TODO Error?
    return [[cursor.from, cursor.to]];
  }

  /** @type {[number, number][]} */
  let rendered_positions = [];

  cursor.firstChild();
  cursor.firstChild();
  parent: for (let index of position.slice(0, -1)) {
    let current_index = 0;
    do {
      if (index === current_index) {
        cursor.firstChild(); // Go into CallExpression, on VariableName
        rendered_positions.push([cursor.from, cursor.to]);
        cursor.nextSibling(); // Onto ArgList
        cursor.firstChild(); // Enter ArgList
        cursor.nextSibling(); // Skip "("
        continue parent;
      }
      current_index++;
      // Skip current node and the "," after it
    } while (cursor.nextSibling() && cursor.nextSibling());
    throw new Error("couldn't find index in tree?");
  }

  // @ts-ignore
  for (let _ of range(0, position.at(-1))) {
    cursor.nextSibling();
    cursor.nextSibling();
  }
  rendered_positions.push([cursor.from, cursor.to]);
  return rendered_positions;
};
export let let_me_know_what_node_i_clicked = [
  EditorView.updateListener.of((update) => {
    if (update.selectionSet) {
      let tree = syntaxTree(update.state);
      let cursor = tree.cursor();
      let positions = cursor_to_tree_position(cursor, [
        update.state.selection.main.from,
        update.state.selection.main.to,
      ]);
      open_specific_node_emitter.emit(positions);
    }
  }),
  EditorView.domEventHandlers({
    blur: (view) => {
      open_specific_node_emitter.emit(null);
    },
  }),
];
/** @type {StateEffectType<TreePosition | null>} */
let OpenPositionEffect = StateEffect.define();
let what_to_focus = StateField.define({
  create() {
    return /** @type {readonly [number, number][] | null} */ (null);
  },
  update(value, tr) {
    // TODO Also "focus" on the node you click on:
    // .... Currently does not work because it will also fold it's children >_>
    // if (tr.selection) {
    //   let cursor = syntaxTree(tr.state).cursorAt(tr.selection.main.head);
    //   let positions = /** @type {[number, number][]} */ ([]);
    //   do {
    //     if (cursor.name === "VariableName") {
    //       positions.push([cursor.from, cursor.to]);
    //     }
    //     if (cursor.name === "CallExpression") {
    //       cursor.firstChild();
    //       try {
    //         positions.unshift([cursor.from, cursor.to]);
    //       } finally {
    //         cursor.parent();
    //       }
    //     }
    //   } while (cursor.parent());
    //   return positions;
    // }
    for (let effect of tr.effects) {
      if (effect.is(OpenPositionEffect)) {
        if (effect.value == null) {
          return null;
        }

        try {
          let positions = tree_position_to_cursor(
            syntaxTree(tr.state).cursor(),
            effect.value
          );
          return positions;
        } catch (error) {
          // This isn't that important, so don't crash anything
          console.error("Error in tree_position_to_cursor", error);
        }
      }
    }
    return value;
  },
});

let node_that_contains_selection_field = StateField.define({
  create() {
    return /** @type {import("@lezer/common").SyntaxNode?} */ (null);
  },
  update(value, tr) {
    if (tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState)) {
      let tree = syntaxTree(tr.state);

      // YES I HAVE TO MAKE EVERYTHING COMPLEX I LOVE IT
      let selection_head = tr.state.selection.main.head;
      if (tr.state.sliceDoc(selection_head - 1, selection_head) === ")") {
        selection_head = selection_head - 1;
      } else if (
        tr.state.sliceDoc(selection_head, selection_head + 1) === ")"
      ) {
        selection_head = selection_head - 1;
      }

      let cursor = tree.cursorAt(selection_head, 1);
      if (cursor.name === ",") cursor.prevSibling();

      // Easily selectable nodes
      if (
        cursor.node.parent?.name === "ArgList" &&
        cursor.node.parent?.parent?.name === "CallExpression"
      ) {
        if (cursor.name === "VariableName") {
          return cursor.node;
        }
        if (cursor.name === "String") {
          return cursor.node;
        }
      }

      do {
        if (cursor.name === "CallExpression") {
          cursor.firstChild(); // Get callee (VariableName)
          return cursor.node;
        }
        if (cursor.name === "NewExpression") {
          return cursor.node;
        }
      } while (cursor.parent());
    }
    return value;
  },
});

let all_this_just_to_click = [
  ViewPlugin.define((view) => {
    let handle = (position) => {
      view.dispatch({
        effects: OpenPositionEffect.of(position),
      });
    };
    open_specific_node_emitter.on(handle);
    return {
      destroy() {
        open_specific_node_emitter.off(handle);
      },
    };
  }),
  what_to_focus,
  EditorView.theme({
    ".FOCUSSED": {
      filter: "brightness(2)",
    },
    ".VERY-FOCUSSED": {
      filter: "brightness(4)",
    },
  }),
  // Very hacky way to say "JUST FOCUS ON THIS NOW EH"
  // (The selected element wouldn't )
  EditorView.domEventHandlers({
    dblclick: () => {
      // @ts-ignore
      document.activeElement?.blur?.();
    },
  }),
  node_that_contains_selection_field,
  EditorView.decorations.compute(
    [what_to_focus, node_that_contains_selection_field],
    (state) => {
      let focus_thing = state.field(what_to_focus);
      let node_that_contains_selection = state.field(
        node_that_contains_selection_field
      );
      if (focus_thing != null) {
        let parents = focus_thing.slice(0, -1);
        let last = focus_thing.at(-1);

        let decorations = [];
        for (let [from, to] of parents) {
          decorations.push(
            Decoration.mark({
              class: "FOCUSSED",
            }).range(from, to)
          );
        }

        if (last) {
          decorations.push(
            Decoration.mark({
              class: "VERY-FOCUSSED",
            }).range(last[0], last[1])
          );
        }
        return Decoration.set(decorations);
      } else if (node_that_contains_selection != null) {
        let cursor = node_that_contains_selection.cursor();
        // Use unshift on the decorations, because we are going from inner to outer node
        // (e.g. "in the wrong direction")
        let decorations = [];

        decorations.unshift(
          Decoration.mark({
            class: "VERY-FOCUSSED",
          }).range(cursor.from, cursor.to)
        );
        while (cursor.parent()) {
          if (cursor.name === "CallExpression") {
            cursor.firstChild();
            decorations.unshift(
              Decoration.mark({
                class: "FOCUSSED",
              }).range(cursor.from, cursor.to)
            );
            cursor.parent();
          }
        }
        return Decoration.set(decorations);
      } else {
        return Decoration.none;
      }
    }
  ),
  EditorView.updateListener.of((update) => {
    let plllt = update.state.field(what_to_focus);
    if (
      update.startState.field(what_to_focus, false) !== plllt &&
      plllt !== null
    ) {
      let x = plllt.at(-1)?.[0];
      if (x != null) {
        update.view.dispatch({
          effects: [
            EditorView.scrollIntoView(x, { y: "nearest", x: "nearest" }),
          ],
        });
      }
    }
  }),
];
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////

/**
 * @typedef RangeTuple
 * @type {readonly [number, number]}
 */

/** @type {StateEffectType<{ from: number, to: number }>} */
let FoldEffect = StateEffect.define();
/** @type {StateEffectType<{ from: number, to: number }>} */
let UnfoldEffect = StateEffect.define();
let what_to_fold = StateField.define({
  create() {
    return /** @type {Array<RangeTuple>} */ ([]);
  },
  update(value, tr) {
    if (tr.docChanged) {
      return [];
    }
    let focusmehhh = tr.state.field(what_to_focus);
    if (
      focusmehhh !== tr.startState.field(what_to_focus, false) &&
      focusmehhh != null
    ) {
      let folds = tr.state.facet(AllFoldsFacet);
      // @ts-ignore
      let [from, to] = focusmehhh.at(-1);
      let new_folds = folds
        .filter((x) => {
          return to < x.fold_from || x.fold_to < from;
        })
        .map((x) => /** @type {RangeTuple} */ ([x.fold_from, x.fold_to]));
      return new_folds;
    }

    if (tr.selection != null) {
      let { main } = tr.selection;
      // Remove all folds that contain the cursor
      return value.filter(([from, to]) => !(from < main.from && main.to < to));
    }

    return produce(value, (value) => {
      for (let effect of tr.effects) {
        if (effect.is(FoldEffect)) {
          // Find index of where this fold would fit if sorted by `from`
          let raw_index = value.findIndex((x) => x[0] > effect.value.from);
          let index = Math.max(raw_index === -1 ? value.length : raw_index, 0);
          value.splice(index, 0, [effect.value.from, effect.value.to]);
          // value.push([effect.value.from, effect.value.to]);
        }
        if (effect.is(UnfoldEffect)) {
          let index = value.findIndex(
            ([from, to]) => from === effect.value.from && to === effect.value.to
          );
          if (index !== -1) {
            value.splice(index, 1);
          }
        }
      }
    });
  },
  // provide: (value) => EditorView.decorations.from(value, (value) => Decoration.none)
});

let FoldedRegion = ({ from, to }) => {
  let view = useEditorView();

  return (
    <span
      className="ellipsis"
      // data-from={from}
      // data-to={to}
      onClick={() => {
        view.dispatch({
          effects: UnfoldEffect.of({ from, to }),
        });
      }}
    >
      <span className="ellipsis">{" … "}</span>
    </span>
  );
};

/**
 * @typedef FoldableCall
 * @type {{
 *  from: number,
 *  to: number,
 *  fold_from: number,
 *  fold_to: number,
 * }}
 */

/** @type {Facet<FoldableCall[], FoldableCall[]>} */
let AllFoldsFacet = Facet.define({
  combine: (values) => values[0],
});

class SpaceRange extends RangeValue {}
let SPACE_RANGE = new SpaceRange();
let atomic_spaces = EditorView.atomicRanges.of((view) => {
  let doc = view.state.doc;
  let ranges = new RangeSetBuilder();
  for (let { index, 0: text } of doc.sliceString(0).matchAll(/\s+/g)) {
    index = /** @type {number} */ (index);
    ranges.add(index, index + text.length, SPACE_RANGE);
  }
  return ranges.finish();
});

let lezer_as_javascript_plugins = [
  new LanguageSupport(javascriptLanguage),
  codeFolding(),
  all_this_just_to_click,
  what_to_fold,
  fold_style,
  atomic_spaces,
  AllFoldsFacet.compute(["doc"], (state) => {
    let cursor = syntaxTree(state).cursor();
    /** @type {FoldableCall[]} */
    let ranges = [];
    iterate_over_cursor({
      cursor: cursor,
      enter: (cursor) => {
        if (cursor.name === "CallExpression") {
          let node = cursor.node;
          let callee = node.firstChild;
          let arg_list = node.getChild("ArgList");

          if (callee == null || arg_list == null) return;

          ranges.push({
            from: callee.from,
            to: callee.to,
            fold_from: arg_list.from + 1,
            fold_to: arg_list.to - 1,
          });
        }
      },
    });
    return ranges;
  }),
  EditorView.decorations.compute([what_to_fold], (state) => {
    let folds = state.field(what_to_fold);
    let decorations = /** @type {Array<Range<Decoration>>} */ ([]);

    let did_fold = /** @type {Array<[from: number, to: number]>} */ ([]);
    for (let [from, to] of folds) {
      if (did_fold.some(([f, t]) => f >= from && t <= to)) {
        continue;
      }
      did_fold.push([from, to]);

      // Find first 20 characters without counting tabs, newlines and spaces
      let text = state.sliceDoc(from, to);
      let character_to_show_in_front = 0;
      let without_spaces_count = 0;
      for (let index of range(0, text.length)) {
        let char = text[index];
        if (char === " " || char === "\t" || char === "\n") {
          continue;
        }
        without_spaces_count += 1;

        if (without_spaces_count > 20) {
          character_to_show_in_front = index;
          break;
        }
      }

      let character_to_show_in_the_back = 0;
      let without_spaces_count2 = 0;
      for (let index of range(text.length, 0)) {
        let char = text[index];
        if (char === " " || char === "\t" || char === "\n") {
          continue;
        }
        without_spaces_count2 += 1;

        if (without_spaces_count2 > 20) {
          character_to_show_in_the_back = text.length - index;
          break;
        }
      }

      if (
        from + character_to_show_in_front <
        to - character_to_show_in_the_back
      ) {
        decorations.push(
          Decoration.replace({
            widget: new ReactWidget(<FoldedRegion to={to} from={from} />),
          }).range(
            from + character_to_show_in_front,
            to - character_to_show_in_the_back
          )
        );
      }
    }
    return Decoration.set(decorations, true);
  }),
  EditorView.decorations.compute([what_to_fold], (state) => {
    let folds = state.field(what_to_fold);
    let decorations = /** @type {Array<Range<Decoration>>} */ ([]);

    let did_fold = /** @type {Array<[from: number, to: number]>} */ ([]);
    for (let [from, to] of folds) {
      if (did_fold.some(([f, t]) => from <= f && t <= to)) {
        continue;
      }
      did_fold.push([from, to]);
      decorations.push(Decoration.mark({ class: "folded" }).range(from, to));
    }
    return Decoration.set(decorations);
  }),
  EditorView.decorations.compute([what_to_fold], (state) => {
    let folds = state.field(what_to_fold);
    let decorations = /** @type {Array<Range<Decoration>>} */ ([]);

    let did_fold = /** @type {Array<[from: number, to: number]>} */ ([]);
    for (let [from, to] of folds) {
      if (did_fold.some(([f, t]) => f <= from && to <= t)) {
        continue;
      }
      did_fold.push([from, to]);

      let text = state.doc.sliceString(from, to);
      for (let { index, 0: match, 1: pre, 2: post } of text.matchAll(
        /(\()?\s+(\))?/g
      )) {
        index = /** @type {number} */ (index);
        let match_from = from + index + (pre?.length ?? 0);
        let match_to = from + index + match.length - (post?.length ?? 0);

        if (
          pre != null ||
          post != null ||
          index === 0 ||
          index + match.length === text.length
        ) {
          // If the match starts with "(" or /^/, or ends with ")" or /$/,
          // then we get rid of all the spaces
          decorations.push(Decoration.replace({}).range(match_from, match_to));
        } else {
          // If it is just whitespace in the middle, we preserve one space
          decorations.push(
            Decoration.replace({
              widget: new ReactWidget(<span> </span>),
            }).range(match_from, match_to)
          );
        }
      }
    }
    return Decoration.set(decorations);
  }),
  EditorView.decorations.compute([AllFoldsFacet], (state) => {
    // I wanted this to work with the foldNodeProps, but I find that complex and blablabla
    // so imma try without it 😁
    let all_folds = state.facet(AllFoldsFacet);
    return Decoration.set(
      all_folds.map((fold) =>
        Decoration.mark({
          attributes: {
            style: "cursor: pointer",
            "data-from": String(fold.fold_from),
            "data-to": String(fold.fold_to),
            class: "fold-me-daddy",
          },
        }).range(fold.from, fold.to)
      )
    );
  }),
  EditorView.domEventHandlers({
    click: (event, view) => {
      if (!(event.target instanceof HTMLElement)) return;

      let parent = event.target.closest(".fold-me-daddy");
      if (parent == null) return;

      let from = parent.getAttribute("data-from");
      let to = parent.getAttribute("data-to");
      if (from == null && to == null) return;
      let from_num = Number(from);
      let to_num = Number(to);
      if (
        view.state
          .field(what_to_fold)
          .some(([from, to]) => from === from_num && to === to_num)
      ) {
        view.dispatch({
          effects: [UnfoldEffect.of({ from: from_num, to: to_num })],
        });
      } else {
        view.dispatch({
          effects: [FoldEffect.of({ from: from_num, to: to_num })],
        });
      }
    },
  }),
  lezer_result_syntax_classes,
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.string, class: "literal" },
      { tag: t.variableName, class: "variable" },
      { tag: t.punctuation, class: "boring" },
    ])
  ),
  javascript(),
];

let but_disable_all_editting = EditorState.transactionFilter.of((tr) => {
  if (tr.docChanged) {
    return [];
  }
  return tr;
});

/**
 * @param {{
 *  code_to_parse: string,
 *  parser: import("@lezer/lr").LRParser,
 * }} props
 */
export let ParsedResultEditor = ({ code_to_parse, parser }) => {
  let parsed_as_js = React.useMemo(() => {
    try {
      let tree = parser.parse(code_to_parse);
      return cursor_to_javascript(tree.cursor());
    } catch (error) {
      return error.message;
    }
  }, [parser, code_to_parse]);

  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc: parsed_as_js,
      extensions: [base_extensions],
    });
  }, []);

  /** @type {import("react").MutableRefObject<EditorView>} */
  let codemirror_ref = React.useRef(/** @type {any} */ (null));

  React.useLayoutEffect(() => {
    codemirror_ref.current.dispatch({
      changes: {
        from: 0,
        to: codemirror_ref.current.state.doc.length,
        insert: parsed_as_js,
      },
      filter: false,
    });
  }, [parsed_as_js]);

  return (
    <CodeMirror ref={codemirror_ref} state={initial_editor_state}>
      <Extension extension={Decorate_New_Error} />
      <Extension extension={lezer_result_syntax_classes} />
      <Extension extension={lezer_as_javascript_plugins} />
      <Extension extension={but_disable_all_editting} />
    </CodeMirror>
  );
};
