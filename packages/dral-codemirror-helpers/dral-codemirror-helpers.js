import {
  Language,
  syntaxTreeAvailable,
  ensureSyntaxTree,
  syntaxTree,
} from "@codemirror/language";

import { Range, Text, StateField, StateEffect } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { TreeCursor } from "@lezer/common";

// TODO Must have good reasons to make `Language.state` private, but o well
// @ts-ignore
export let SyntaxTreeFacet = Language.state;

/** @param {(context: { cursor: TreeCursor, mutable_decorations: Range<Decoration>[], doc: Text }) => void | boolean} fn */
export let DecorationsFromTree = (fn) => {
  return EditorView.decorations.compute([SyntaxTreeFacet], (state) => {
    // Move verbose way to write `let tree = syntaxTree(state);` but I'm untethered now
    let language_state = state.field(SyntaxTreeFacet, false);
    if (language_state == null) return Decoration.set([]);
    let tree = language_state.tree;

    /** @type {Range<Decoration>[]} */
    let decorations = [];
    iterate_with_cursor({
      tree,
      enter: (/** @type {any} */ cursor) => {
        return fn({ cursor, mutable_decorations: decorations, doc: state.doc });
      },
    });

    return Decoration.set(decorations);
  });
};

let FullParsedEffect = StateEffect.define();

let continue_asking_parser_for_tree = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.ask_for_work(view);
    }

    ask_for_work(view) {
      if (this.idle_callback) {
        window.cancelIdleCallback(this.idle_callback);
      }
      if (syntaxTreeAvailable(view.state)) {
        return true;
      } else {
        this.idle_callback = window.requestIdleCallback(() => {
          let tree = ensureSyntaxTree(view.state, view.state.doc.length, 4);
          if (tree == null) {
            this.ask_for_work(view);
          } else {
            view.dispatch({
              effects: FullParsedEffect.of(null),
            });
          }
        });
        return false;
      }
    }

    update(update) {
      this.ask_for_work(update.view);
    }

    destroy() {
      if (this.idle_callback) {
        window.cancelIdleCallback(this.idle_callback);
      }
    }
  }
);

export let full_syntax_tree_field = StateField.define({
  create(state) {
    return syntaxTreeAvailable(state) ? syntaxTree(state) : null;
  },
  update(value, update) {
    return syntaxTreeAvailable(update.state) ? syntaxTree(update.state) : null;
  },
  provide: () => [continue_asking_parser_for_tree],
});
