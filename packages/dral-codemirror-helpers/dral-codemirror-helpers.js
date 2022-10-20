import { Language } from "@codemirror/language";

import { Range, Text } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { TreeCursor } from "@lezer/common";

/** @param {(context: { cursor: TreeCursor, mutable_decorations: Range<Decoration>[], doc: Text }) => void | boolean} fn */
export let DecorationsFromTree = (fn) => {
  // TODO Must have good reasons to make `Language.state` private, but o well
  // @ts-ignore
  let LanguageField = Language.state;
  return EditorView.decorations.compute([LanguageField], (state) => {
    // Move verbose way to write `let tree = syntaxTree(state);` but I'm untethered now
    let language_state = state.field(LanguageField, false);
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
