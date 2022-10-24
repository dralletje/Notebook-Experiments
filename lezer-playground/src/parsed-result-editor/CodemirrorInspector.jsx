import React from "react";
import { produce } from "immer";
import {
  EditorState,
  Facet,
  Range,
  RangeSetBuilder,
  RangeValue,
  StateEffect,
  StateEffectType,
  StateField,
} from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import {
  codeFolding,
  syntaxTree,
  syntaxTreeAvailable,
} from "@codemirror/language";

import { ReactWidget, useEditorView } from "react-codemirror-widget";
import { LanguageStateFacet } from "@dral/codemirror-helpers";

let fold_style = EditorView.theme({
  ".fold-me-daddy:not(.folded)": {
    // cursor: "pointer",
    // "&:hover": {
    //   "text-decoration": "underline",
    //   "text-decoration-thickness": "3px",
    // },
  },
  ".folded": {
    opacity: "0.5",
  },
  ".ellipsis": {
    "font-weight": "bold",
    color: "#8b8b8b",
  },
});

/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
import { iterate_over_cursor } from "dral-lezer-helpers";
import { range } from "lodash";

let node_that_contains_selection_field = StateField.define({
  create() {
    return /** @type {import("@lezer/common").SyntaxNode?} */ (null);
  },
  update(value, tr) {
    if (tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState)) {
      let tree = syntaxTree(tr.state);
      let selection_head = tr.state.selection.main.head;
      if (tr.state.doc.sliceString(selection_head - 1, selection_head) === "}")
        selection_head = selection_head - 1;
      let cursor = tree.cursorAt(selection_head, 1);

      do {
        // TODO Make this select the whole node, and highlight that in a nice way?
        if (cursor.name === "Node") {
          cursor.firstChild(); // Get callee (VariableName)
          return cursor.node;
        }
      } while (cursor.parent());
    }
    return value;
  },
});

let all_this_just_to_click = [
  EditorView.theme({
    ".FOCUSSED": {
      "text-decoration": "underline 3px #ffffff40",
      "text-underline-offset": "3px",
      "text-decoration-skip-ink": "none",
    },
    ".VERY-FOCUSSED": {
      "text-decoration": "underline 3px #ffffffaa",
      "text-underline-offset": "3px",
      "text-decoration-skip-ink": "none",
    },
  }),
  node_that_contains_selection_field,
  EditorView.decorations.compute(
    [node_that_contains_selection_field],
    (state) => {
      let node_that_contains_selection = state.field(
        node_that_contains_selection_field
      );
      if (node_that_contains_selection != null) {
        let cursor = node_that_contains_selection.cursor();
        // Use unshift on the decorations, because we are going from inner to outer node
        // (e.g. "in the wrong direction")
        let decorations = [];

        decorations.unshift(
          Decoration.mark({
            class: "VERY-FOCUSSED",
          }).range(cursor.from, cursor.to)
        );
        cursor.parent();
        while (cursor.parent()) {
          if (cursor.name === "Node") {
            cursor.firstChild();
            decorations.unshift(
              Decoration.mark({
                class: "FOCUSSED",
              }).range(cursor.from, cursor.to)
            );
            cursor.parent();
          }
        }
        // console.log(`#3 decorations:`, decorations);
        return Decoration.set(decorations);
      } else {
        return Decoration.none;
      }
    }
  ),
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
export let FoldAllEffect = StateEffect.define();
let what_to_fold = StateField.define({
  create() {
    return /** @type {Array<RangeTuple>} */ ([]);
  },
  update(value, tr) {
    if (tr.docChanged) {
      value = [];
    }

    value = produce(value, (value) => {
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
        if (effect.is(FoldAllEffect)) {
          // @ts-expect-error Immer makes the type of `value` mutable, but assigning readonly is fine...
          value = tr.state.facet(AllFoldsFacet).map((x) => x.fold);
        }
      }

      return value;
    });

    if (tr.selection != null) {
      let { main } = tr.selection;
      // Remove all folds that contain the cursor
      value = value.filter(([from, to]) => !(from < main.from && main.to < to));
    }

    return value;
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
 *  name: RangeTuple,
 *  fold: RangeTuple,
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
  for (let { index, 0: text } of doc
    .sliceString(0)
    .matchAll(/(\()?\s+(\))?/g)) {
    index = /** @type {number} */ (index);
    ranges.add(index, index + text.length, SPACE_RANGE);
  }
  return ranges.finish();
});

let but_disable_all_editting = EditorState.transactionFilter.of((tr) => {
  if (tr.docChanged) {
    return [];
  }
  return tr;
});

// class SpaceWidget extends ReactWidget {
//   constructor() {
//     super(" ");
//   }
//   eq() {
//     return true;
//   }
// }
class SpaceWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    let span = document.createElement("span");
    span.textContent = " ";
    return span;
  }
}

export let lezer_result_as_lezer_extensions = [
  codeFolding(),
  all_this_just_to_click,
  what_to_fold,
  fold_style,
  atomic_spaces,

  AllFoldsFacet.compute([LanguageStateFacet], (state) => {
    let cursor = syntaxTree(state).cursor();
    /** @type {FoldableCall[]} */
    let ranges = [];
    iterate_over_cursor({
      cursor: cursor,
      enter: (cursor) => {
        if (cursor.name === "Node") {
          let node = cursor.node;
          let callee = node.firstChild;
          let arg_list = node.getChild("Arguments");

          if (callee == null || arg_list == null) return;

          ranges.push({
            name: [callee.from, callee.to],
            fold: [arg_list.from + 1, arg_list.to - 1],
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
      if (did_fold.some(([f, t]) => f <= from && to <= t)) {
        continue;
      }
      did_fold.push([from, to]);

      // Find first 20 characters without counting tabs, newlines and spaces
      let text = state.sliceDoc(from, to);
      let character_to_show_in_front = 0;
      let without_spaces_count = 0;
      for (let index of range(0, text.length)) {
        let char = text[index];
        character_to_show_in_front += 1;
        if (char === " " || char === "\t" || char === "\n") {
          continue;
        }
        without_spaces_count += 1;

        if (without_spaces_count > 20) {
          break;
        }
      }

      let character_to_show_in_the_back = 0;
      let without_spaces_count2 = 0;
      for (let index of range(text.length, 0)) {
        let char = text[index];
        character_to_show_in_the_back += 1;
        if (char === " " || char === "\t" || char === "\n") {
          continue;
        }
        without_spaces_count2 += 1;

        if (without_spaces_count2 > 10) {
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
      if (did_fold.some(([f, t]) => f <= from && to <= t)) {
        continue;
      }
      did_fold.push([from, to]);
      decorations.push(Decoration.mark({ class: "folded" }).range(from, to));
    }
    // console.log(`#1 decorations:`, decorations);
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
      for (let { index, 0: match, 1: pre, 2: post } of text.matchAll(/\s+/g)) {
        index = /** @type {number} */ (index);
        let match_from = from + index + (pre?.length ?? 0);
        let match_to = from + index + match.length - (post?.length ?? 0);
        // If it is just whitespace in the middle, we preserve one space
        decorations.push(
          Decoration.replace({
            widget: new SpaceWidget(),
          }).range(match_from, match_to)
        );
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
            // style: "cursor: pointer",
            "data-from": String(fold.fold[0]),
            "data-to": String(fold.fold[1]),
            class: "fold-me-daddy",
          },
        }).range(fold.name[0], fold.name[1])
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
  but_disable_all_editting,
];
