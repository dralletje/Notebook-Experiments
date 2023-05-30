import { Decoration, EditorView } from "@codemirror/view";

import { DecorationsFromTree } from "@dral/codemirror-helpers";

// TODO Hide everything but the text unless selected

export let markdown_links = [
  EditorView.baseTheme({
    ".link-mark": {
      opacity: 0.5,
    },
    ".link-mark, .link-mark .link": {
      color: "white",
    },
    ".link": {
      color: "var(--accent-color)",
    },
    ".url, .url .link": {
      color: "white",
      opacity: 0.5,
    },
  }),

  // These are separate because they need "lower precedence" so they don't "slice" the bigger elements:
  // `*sad*` would become `<em><mark>*</mark>sad</em><mark><em>*</em></mark>` (confusing)
  // instead of `<em><mark>*</mark>sad<mark>*</mark></em>` (normal)
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "LinkMark") {
      mutable_decorations.push(
        Decoration.mark({ class: "link-mark" }).range(cursor.from, cursor.to)
      );
    }
  }),
  DecorationsFromTree(({ cursor, mutable_decorations }) => {
    if (cursor.name === "URL") {
      mutable_decorations.push(
        Decoration.mark({ class: "url" }).range(cursor.from, cursor.to)
      );
    }
    if (cursor.name === "Link") {
      mutable_decorations.push(
        Decoration.mark({ class: "link" }).range(cursor.from, cursor.to)
      );
    }
  }),
];
