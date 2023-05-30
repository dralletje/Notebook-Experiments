import { EditorView, WidgetType, Decoration } from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { range } from "lodash";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { DecorationsFromTree } from "@dral/codemirror-helpers";
import { EditorSelection, EditorState } from "@codemirror/state";

// TODO Merge this someway with `text-marks.js`, they both use this "hide untill in selection" thing
// .... and the "put assoc outside of the markers" thing. Could be nice to have a "text mark" package.

let put_assoc_outside_of_the_markers = EditorState.transactionFilter.of(
  (transaction) => {
    let selection = transaction.newSelection.main;
    if (!selection.empty) return transaction;

    // Weirdly enough, when `assoc` is 0, lezer returns the wrong node.
    // So in that case I assume
    let assoc = selection.assoc || 1;

    // When the document has changed I need to get the new syntax tree using the new state,
    // which is expensive to calculate...
    // Lets hope the document doesn't change too often...
    let tree = transaction.docChanged
      ? ensureSyntaxTree(transaction.state, selection.head, 50)
      : ensureSyntaxTree(transaction.startState, selection.head, 50);

    if (tree == null) {
      console.warn("wtf");
      return transaction;
    }

    if (tree.cursorAt(selection.head, assoc).name !== "InlineTagMark")
      return transaction;

    // Just do `assoc * -1`? Typescript doesn't like that..
    let better_assoc: 1 | -1 = assoc === 1 ? -1 : 1;

    if (tree.cursorAt(selection.head, better_assoc).name === "InlineTagMark")
      return transaction;

    if (transaction.docChanged) {
      // prettier-ignore
      console.log("⚠ RECALCULATING THE WHOLE STATE in markdown transactionFilter");
    }

    let new_selection = EditorSelection.create([
      EditorSelection.cursor(
        selection.head,
        better_assoc,
        selection.bidiLevel ?? 0, // ?? 0 is for typescript
        selection.goalColumn
      ),
    ]);
    return [transaction, { selection: new_selection, sequential: true }];
  }
);

let DECORATION_CLASS = "subtle-text-decoration";
let MARK_CLASS = "subtle-text-decoration-mark";
let SHOW_MARK_CLASS = "subtle-text-decoration-show-mark";

let hide_marks_except_when_selected = EditorView.theme({
  [`.${DECORATION_CLASS} .${MARK_CLASS}`]: {
    display: "inline-block", // Allows for `transform` and `width`
    height: 0, // Makes sure it doesn't stretch the line height
    "white-space": "pre", // Makes sure it doesn't wrap when the width is tight
    width: 0, // Make the width tight
    transform: `scaleX(0)`, // And also make the intrinsic width 0
  },
  [`&.has-selection .${SHOW_MARK_CLASS} .${MARK_CLASS}`]: {
    height: "unset",
    width: "unset",
    transform: `unset`,
  },
});

let markdown_inline_decorations = ["InlineTag"];

let re_mark_marks_that_are_in_selection = EditorView.decorations.compute(
  ["doc", "selection"],
  (state) => {
    let tree = syntaxTree(state);
    let decorations = [];

    let cursor = tree.cursorAt(state.selection.main.from, 1);
    let cursor_to = tree.cursorAt(state.selection.main.to, -1);

    // Both go to the first parent matching an inline decoration
    do {} while (
      !markdown_inline_decorations.includes(cursor.name) &&
      cursor.parent()
    );
    do {} while (
      !markdown_inline_decorations.includes(cursor_to.name) &&
      cursor_to.parent()
    );

    // If the selections are in the same node, sweet, else, bail
    if (cursor.to !== cursor_to.to) return Decoration.none;
    if (cursor.from !== cursor_to.from) return Decoration.none;

    do {
      if (markdown_inline_decorations.includes(cursor.name)) {
        // Begin with end mark because I reverse the array in the end
        // and start needs to be first, eventually
        let end_mark = cursor.node.lastChild;
        decorations.push(
          Decoration.mark({ class: SHOW_MARK_CLASS }).range(
            end_mark.from,
            end_mark.to
          )
        );
        let start_mark = cursor.node.firstChild;
        decorations.push(
          Decoration.mark({ class: SHOW_MARK_CLASS }).range(
            start_mark.from,
            start_mark.to
          )
        );
      }
    } while (cursor.parent());
    return Decoration.set(decorations, true);
  }
);

// These are separate because they need "lower precedence" so they don't "slice" the bigger elements:
// `*sad*` would become `<em><mark>*</mark>sad</em><mark><em>*</em></mark>` (confusing)
// instead of `<em><mark>*</mark>sad<mark>*</mark></em>` (normal)
let decorate_marks = DecorationsFromTree(({ cursor, mutable_decorations }) => {
  if (cursor.name === "InlineTagMark") {
    // TODO Add tag name to the mark so I can style it based on that
    mutable_decorations.push(
      Decoration.mark({ class: `inline-tag-marker ${MARK_CLASS}` }).range(
        cursor.from,
        cursor.to
      )
    );
  }
});
let decorate_text = DecorationsFromTree(
  ({ cursor, mutable_decorations, doc }) => {
    if (cursor.name === "InlineTag") {
      let mark = cursor.node.firstChild;
      let tag = doc.sliceString(mark.from + 1, mark.to - 1) || "span";
      mutable_decorations.push(
        Decoration.mark({
          tagName: tag,
          class: DECORATION_CLASS,
        }).range(cursor.from, cursor.to)
      );
    }
  }
);

export let markdown_inline_tag = [
  decorate_marks,
  re_mark_marks_that_are_in_selection,
  decorate_text,

  hide_marks_except_when_selected,
  EditorView.baseTheme({
    kbd: {
      "--color-fg-default": "#e4e8ec",
      "--color-canvas-subtle": "#161b22",
      "--color-neutral-muted": "rgba(110,118,129,0.4)",

      position: "relative",

      display: "inline-block",
      padding: "4px 5px",
      font: "0.8em ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace",
      "line-height": "0.8",
      color: "var(--color-fg-default)",
    },
    "kbd::before": {
      content: "''",
      position: "absolute",
      inset: "0",

      // Needs to be lower than cm-selection's z-index: -2
      // TODO Investigate why cm-selection has hardcoded z-index: -2
      "z-index": "-3",

      "background-color": "var(--color-canvas-subtle)",
      border: "solid 1px var(--color-neutral-muted)",
      "border-bottom-color": "var(--color-neutral-muted)",
      "border-radius": "6px",
      "box-shadow": "inset 0 -1px 0 var(--color-neutral-muted)",
    },
    ".inline-tag-marker": {
      color: "#555555",
    },
  }),

  put_assoc_outside_of_the_markers,
];
