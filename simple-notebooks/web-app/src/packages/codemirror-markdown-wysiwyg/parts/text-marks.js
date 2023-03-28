import {
  EditorState,
  EditorSelection,
  SelectionRange,
} from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { DecorationsFromTree } from "@dral/codemirror-helpers";
import { Tree } from "@lezer/common";
import { iterate_over_cursor, iterate_with_cursor } from "dral-lezer-helpers";

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

let styles = EditorView.baseTheme({
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
    // outline: "1px solid #ffffff36",
    border: "1px solid #ffffff36",
    padding: "0 5px",
    margin: "0 2px",
    "border-radius": "2px",
    "box-decoration-break": "clone",
    "-webkit-box-decoration-break": "clone",
  },
});
// These are separate because they need "lower precedence" so they don't "slice" the bigger elements:
// `*sad*` would become `<em><mark>*</mark>sad</em><mark><em>*</em></mark>` (confusing)
// instead of `<em><mark>*</mark>sad<mark>*</mark></em>` (normal)
let decorate_marks = DecorationsFromTree(({ cursor, mutable_decorations }) => {
  if (cursor.name in markdown_mark_to_decoration) {
    mutable_decorations.push(
      markdown_mark_to_decoration[cursor.name].range(cursor.from, cursor.to)
    );
  }
});
let decorate_text = DecorationsFromTree(({ cursor, mutable_decorations }) => {
  if (cursor.name in markdown_inline_decorations) {
    mutable_decorations.push(
      markdown_inline_decorations[cursor.name].range(cursor.from, cursor.to)
    );
  }
});

let marks_to_avoid = Object.keys(markdown_mark_to_decoration);
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
  }
);

/**
 * @param {Tree} tree
 * @param {SelectionRange} range
 * @returns {SelectionRange}
 */
let expand_selection_to_the_whole_node = (tree, range) => {
  let start_cursor = tree.cursorAt(range.from, -1);
  let end_cursor = tree.cursorAt(range.to, 1);

  let ammended_start = /** @type {number | null} */ (null);
  let ammended_end = /** @type {number | null} */ (null);

  if (start_cursor.name in markdown_mark_to_decoration) {
    let decorated_text = start_cursor.node.parent;
    let end_mark = decorated_text.lastChild;
    if (range.to >= end_mark.from) {
      ammended_start = start_cursor.from;
    }
  }

  if (end_cursor.name in markdown_mark_to_decoration) {
    let decorated_text = end_cursor.node.parent;
    let start_mark = decorated_text.firstChild;
    if (range.from <= start_mark.to) {
      ammended_end = end_cursor.to;
    }
  }

  if (ammended_start !== null || ammended_end !== null) {
    return EditorSelection.range(
      ammended_start ?? range.from,
      ammended_end ?? range.to
    );
  } else {
    return range;
  }
};

let select_markers_when_selecting_the_whole_thing =
  EditorState.transactionFilter.of((transaction) => {
    let initial_selection = transaction.newSelection.main;
    if (initial_selection.empty) return transaction;

    let tree = syntaxTree(transaction.startState);

    let current_selection = initial_selection;
    for (let i = 0; i < 100; i++) {
      let new_selection = expand_selection_to_the_whole_node(
        tree,
        current_selection
      );
      if (!new_selection.eq(current_selection)) {
        current_selection = new_selection;
        continue;
      } else {
        if (new_selection.eq(initial_selection)) {
          return transaction;
        } else {
          return [
            transaction,
            {
              selection:
                // This lil' trick is to have the `head`, the part of the selection that
                // shows the blinking cursor, doesn't suddenly switch places on expansion.
                initial_selection.anchor < initial_selection.head
                  ? EditorSelection.create([new_selection])
                  : EditorSelection.create([
                      EditorSelection.range(
                        new_selection.to,
                        new_selection.from
                      ),
                    ]),
            },
          ];
        }
      }
    }
    throw new Error("Whaaaaat");
  });

let TODO_clicking_end_of_line_should_take_you_to_end_of_line =
  EditorState.transactionFilter.of((transaction) => {
    // TODO
    // 1. Find out if the new selection is at the start of a mark
    // 2. If it is, then figure out if that mark is just before the end of a line
    // 3. Make sure the mark was invisible in the previous selection
    // 4. If all of the above is true, then set the selection to the end of the line

    return transaction;
  });

let hide_marks_except_when_selected = EditorView.theme({
  ".text-decoration .mark": {
    display: "inline-block", // Allows for `transform` and `width`
    height: 0, // Makes sure it doesn't stretch the line height
    "white-space": "pre", // Makes sure it doesn't wrap when the width is tight
    width: 0, // Make the width tight
    transform: `scaleX(0)`, // And also make the intrinsic width 0
  },
  "&.has-selection .show-mark .mark": {
    width: "unset", // Make the width tight
    transform: `unset`, // And also make the intrinsic width 0
  },
});

// TODO Compute based on syntaxtree 😅
let re_mark_marks_that_are_in_selection = EditorView.decorations.compute(
  ["doc", "selection"],
  (state) => {
    let tree = syntaxTree(state);
    let decorations = [];

    let cursor = tree.cursorAt(state.selection.main.from, 1);
    let cursor_to = tree.cursorAt(state.selection.main.to, -1);

    // Both go to the first parent matching an inline decoration
    do {} while (
      !(cursor.name in markdown_inline_decorations) &&
      cursor.parent()
    );
    do {} while (
      !(cursor_to.name in markdown_inline_decorations) &&
      cursor_to.parent()
    );

    // If the selections are in the same node, sweet, else, bail
    if (cursor.to !== cursor_to.to) return Decoration.none;
    if (cursor.from !== cursor_to.from) return Decoration.none;

    do {
      if (cursor.name in markdown_inline_decorations) {
        // Begin with end mark because I reverse the array in the end
        // and start needs to be first, eventually
        let end_mark = cursor.node.lastChild;
        decorations.push(
          Decoration.mark({ class: "show-mark" }).range(
            end_mark.from,
            end_mark.to
          )
        );
        let start_mark = cursor.node.firstChild;
        decorations.push(
          Decoration.mark({ class: "show-mark" }).range(
            start_mark.from,
            start_mark.to
          )
        );
      }
    } while (cursor.parent());
    return Decoration.set(decorations, true);
  }
);

export let markdown_text_decorations = [
  // First in the plugin list means deepest in the DOM
  // This order will give me, for `*foo*`, when selected:
  // DECORATION(
  //   SHOW_MARK(MARK)
  //   text
  //   SHOW_MARK(MARK)
  // )
  // Which works and is _clean enough_.
  // It gets really messy when there is multiple marks...
  decorate_marks,
  re_mark_marks_that_are_in_selection,
  decorate_text,

  put_assoc_outside_of_the_markers,
  select_markers_when_selecting_the_whole_thing,
  TODO_clicking_end_of_line_should_take_you_to_end_of_line,

  styles,
  hide_marks_except_when_selected,
  simple_text_keymap,
];
