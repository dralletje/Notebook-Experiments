/**
 * @typedef LanguageState
 * @type {LanguageStateClassDoNotInstantiate}
 */
/**
 * TODO Must have good reasons to make `Language.state` private, but o well
 * @type {StateField<LanguageState, LanguageState>}
 */
export let LanguageStateField: StateField<LanguageState, LanguageState>;
export function DecorationsFromTree(fn: (context: {
    cursor: TreeCursor;
    mutable_decorations: Range<Decoration>[];
    doc: Text;
}) => void | boolean): import("@codemirror/state").Extension;
export function DecorationsFromTreeSortForMe(fn: (context: {
    cursor: TreeCursor;
    mutable_decorations: Range<Decoration>[];
    doc: Text;
}) => void | boolean): import("@codemirror/state").Extension;
export function CollectFromTree<ValueToCollect, ValueToReturn = ValueToCollect[]>({ what, with: _with, compute, combine, }: {
    what: Facet<any, readonly any[]>;
    with?: [deps: readonly ("doc" | "selection" | Facet<any, any> | StateField<any>)[], get: (state: EditorState) => any][0];
    compute: (context: {
        cursor: TreeCursor;
        state: EditorState;
        accumulator: ValueToCollect[];
    }) => void | boolean;
    combine: (value: ValueToCollect[]) => ValueToReturn;
}): import("@codemirror/state").Extension;
export type LanguageContext = any;
export type LanguageState = LanguageStateClassDoNotInstantiate;
import { StateField } from "@codemirror/state";
import { TreeCursor } from "@lezer/common";
import { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { Text } from "@codemirror/state";
import { Facet } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
/**
 * @typedef LanguageContext
 * @type {any}
 */
/**
 * This class just exists to provide a type
 */
declare class LanguageStateClassDoNotInstantiate {
    /** @type {import("@lezer/common").Tree} */
    tree: import("@lezer/common").Tree;
    /** @type {LanguageContext} */
    context: LanguageContext;
}
export {};
