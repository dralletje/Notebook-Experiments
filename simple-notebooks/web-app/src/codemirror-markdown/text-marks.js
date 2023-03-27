import { EditorState, EditorSelection } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { DecorationsFromTree } from "@dral/codemirror-helpers";

let insert_around_command = (str) => (view) => {
  let { from, to } = view.state.selection.main;
  if (from === to) return false;

  view.dispatch({
    changes: [
      { from: from, to: from, insert: str },
      { from: to, to: to, insert: str },
    ],
  });
  return true;
};

let toggle_around_command = (str) => (view) => {
  let { from, to } = view.state.selection.main;
  if (view.state.selection.main.empty) {
    view.dispatch({
      changes: { from: from, to: to, insert: `${str}${str}` },
      selection: EditorSelection.single(from + str.length),
    });
    return true;
  }

  if (
    view.state.doc.sliceString(from - str.length, from) === str &&
    view.state.doc.sliceString(to, to + str.length) === str
  ) {
    view.dispatch({
      changes: [
        { from: from - str.length, to: from, insert: "" },
        { from: to, to: to + str.length, insert: "" },
      ],
    });
    return true;
  }

  if (
    view.state.doc.sliceString(from, from + str.length) === str &&
    view.state.doc.sliceString(to - str.length, to) === str
  ) {
    view.dispatch({
      changes: [
        { from: from, to: from + str.length, insert: "" },
        { from: to - str.length, to: to, insert: "" },
      ],
    });
    return true;
  }

  view.dispatch({
    changes: [
      { from: from, to: from, insert: str },
      { from: to, to: to, insert: str },
    ],
  });
  return true;
};

let markdown_mark_to_decoration = {
  CodeMark: Decoration.mark({ class: "code-mark mark" }),
  EmphasisMark: Decoration.mark({ class: "emphasis-mark mark" }),
  StrikethroughMark: Decoration.mark({ class: "strikethrough-mark mark" }),
  SubscriptMark: Decoration.mark({
    class: "subscript-mark mark",
    inclusive: false,
  }),
  SuperscriptMark: Decoration.mark({
    class: "superscript-mark mark",
    inclusive: false,
  }),
};

let markdown_inline_decorations = {
  Emphasis: Decoration.mark({ class: "emphasis text-decoration" }),
  Strikethrough: Decoration.mark({ class: "strikethrough text-decoration" }),
  StrongEmphasis: Decoration.mark({ class: "strong-emphasis text-decoration" }),
  Subscript: Decoration.mark({ tagName: "sub", class: "text-decoration" }),
  Superscript: Decoration.mark({
    tagName: "sup",
    class: "text-decoration",
  }),
  InlineCode: Decoration.mark({
    tagName: "code",
    class: "inline-code text-decoration",
  }),
};

let x0 = EditorView.baseTheme({
  ".emphasis-mark": {
    opacity: "0.5",
    "letter-spacing": "-0.1em",
    transform: "translateX(-0.05em)",
  },
  ".strikethrough-mark": {
    "text-decoration": "line-through",
    "text-decoration-color": "transparent",
    opacity: "0.5",
  },
  ".superscript-mark, .subscript-mark": {
    opacity: "0.3",
  },
  ".inline-code .code-mark": {
    opacity: "0.5",
  },

  ".strikethrough": {
    "text-decoration": "line-through",
  },
  ".emphasis": {
    "font-style": "italic",
  },
  ".strong-emphasis": {
    "font-weight": "bold",
  },
  ".inline-code": {
    "font-size": "0.9em",
    outline: "1px solid #ffffff36",
    display: "inline-block",
    padding: "0 5px",
    margin: "0 2px",
    "border-radius": "2px",
  },
});
// These are separate because they need "lower precedence" so they don't "slice" the bigger elements:
// `*sad*` would become `<em><mark>*</mark>sad</em><mark><em>*</em></mark>` (confusing)
// instead of `<em><mark>*</mark>sad<mark>*</mark></em>` (normal)
let x1 = DecorationsFromTree(({ cursor, mutable_decorations }) => {
  if (cursor.name in markdown_mark_to_decoration) {
    mutable_decorations.push(
      markdown_mark_to_decoration[cursor.name].range(cursor.from, cursor.to)
    );
  }
});
let x2 = DecorationsFromTree(({ cursor, mutable_decorations }) => {
  if (cursor.name in markdown_inline_decorations) {
    mutable_decorations.push(
      markdown_inline_decorations[cursor.name].range(cursor.from, cursor.to)
    );
  }
});

let simple_text_keymap = keymap.of([
  {
    key: "Mod-b",
    run: toggle_around_command("**"),
  },
  {
    key: "Mod-i",
    run: toggle_around_command("_"),
  },
  {
    key: "`",
    run: insert_around_command("`"),
  },
  {
    key: "*",
    run: insert_around_command("*"),
  },
  {
    key: "~",
    run: insert_around_command("~"),
  },
  {
    key: "_",
    run: insert_around_command("_"),
  },
  {
    key: "^",
    run: insert_around_command("^"),
  },
]);

let marks_to_avoid = Object.keys(markdown_mark_to_decoration);
let XXX = EditorState.transactionFilter.of((transaction) => {
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

  for (let mark of marks_to_avoid) {
    if (tree.cursorAt(selection.head, assoc).name !== mark) continue;

    // Just do `assoc * -1`? Typescript doesn't like that..
    /** @type {1 | -1} */
    let better_assoc = assoc === 1 ? -1 : 1;

    if (tree.cursorAt(selection.head, better_assoc).name === mark)
      return transaction;

    if (transaction.docChanged) {
      // prettier-ignore
      console.log("⚠ RECALCULATING THE WHOLE STATE in markdown transactionFilter");
    }

    let new_selection = EditorSelection.create([
      EditorSelection.cursor(
        selection.head,
        better_assoc,
        selection.bidiLevel,
        selection.goalColumn
      ),
    ]);
    return [transaction, { selection: new_selection, sequential: true }];
  }
  return transaction;
});

let hide_marks_except_when_selected = EditorView.theme({
  ".text-decoration .mark": {
    display: "inline-block", // Allows for `transform` and `width`
    "white-space": "pre", // Makes sure it doesn't wrap when the width is tight
    width: 0, // Make the width tight
    transform: `scaleX(0)`, // And also make the intrinsic width 0
  },
  "&.has-selection .text-decoration:has(.selection-mark) > .mark": {
    // "white-space": "pre", // Makes sure it doesn't wrap when the width is tight
    width: "unset", // Make the width tight
    transform: `unset`, // And also make the intrinsic width 0
  },
});

let add_selection_so_i_can_target_in_css = EditorView.decorations.compute(
  ["selection"],
  (state) => {
    let tree = syntaxTree(state);
    let decorations = [];

    let assoc = state.selection.main.assoc || 1;

    // let cursor = tree.cursorAt(state.selection.main.head, assoc)
    return Decoration.set(
      Decoration.mark({
        class: "selection-mark",
      }).range(
        // Math.min(state.selection.main.head, state.selection.main.head + assoc),
        // Math.max(state.selection.main.head, state.selection.main.head + assoc)
        state.selection.main.head - 1,
        state.selection.main.head + 1
      )
    );
  }
);

export let markdown_text_decorations = [
  hide_marks_except_when_selected,
  add_selection_so_i_can_target_in_css,
  x1,
  x2,
  x0,
  XXX,
  simple_text_keymap,
];
