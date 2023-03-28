import { Language } from "@codemirror/language";

import { Range, Text, StateField, Facet, EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { TreeCursor } from "@lezer/common";

/**
 * @typedef LanguageContext
 * @type {any}
 */

/**
 * This class just exists to provide a type
 */
class LanguageStateClassDoNotInstantiate {
  /** @type {import("@lezer/common").Tree} */
  tree = /** @type {any} */ (null);
  /** @type {LanguageContext} */
  context = /** @type {any} */ (null);

  // /** @param {LanguageContext} context */
  // constructor(context) {}
}

/**
 * @typedef LanguageState
 * @type {LanguageStateClassDoNotInstantiate}
 */

/**
 * TODO Must have good reasons to make `Language.state` private, but o well
 * @type {StateField<LanguageState, LanguageState>}
 */
// @ts-ignore
export let LanguageStateField = Language.state;

/** @param {(context: { cursor: TreeCursor, mutable_decorations: Range<Decoration>[], doc: Text }) => void | boolean} fn */
export let DecorationsFromTree = (fn) => {
  return EditorView.decorations.compute([LanguageStateField], (state) => {
    // Move verbose way to write `let tree = syntaxTree(state);` but I'm untethered now
    let language_state = state.field(LanguageStateField, false);
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

/** @param {(context: { cursor: TreeCursor, mutable_decorations: Range<Decoration>[], doc: Text }) => void | boolean} fn */
export let DecorationsFromTreeSortForMe = (fn) => {
  return EditorView.decorations.compute([LanguageStateField], (state) => {
    // Move verbose way to write `let tree = syntaxTree(state);` but I'm untethered now
    let language_state = state.field(LanguageStateField, false);
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

    return Decoration.set(decorations, true);
  });
};

/**
 * @template ValueToCollect
 * @template [ValueToReturn=ValueToCollect[]]
 * @param {{
 *    what: Facet,
 *    with?: Parameters<Facet["compute"]>[0],
 *    compute: (context: {
 *      cursor: TreeCursor,
 *      state: EditorState,
 *      accumulator: ValueToCollect[],
 *    }) => void | boolean,
 *    combine: (value: ValueToCollect[]) => ValueToReturn
 * }} fn
 */
export let CollectFromTree = ({
  what,
  with: _with = [],
  compute,
  combine = (/** @type {any} */ x) => x,
}) => {
  return what.compute([LanguageStateField, ..._with], (state) => {
    // Move verbose way to write `let tree = syntaxTree(state);` but I'm untethered now
    let language_state = state.field(LanguageStateField, false);
    if (language_state == null) return Decoration.set([]);
    let tree = language_state.tree;

    /** @type {ValueToCollect[]} */
    let decorations = [];
    iterate_with_cursor({
      tree,
      enter: (/** @type {any} */ cursor) => {
        return compute({ cursor, accumulator: decorations, state: state });
      },
    });

    return combine(decorations);
  });
};
