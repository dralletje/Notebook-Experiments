import React from "react";
import ReactDOM from "react-dom";

import { syntaxTree } from "@codemirror/language";
import {
  Facet,
  StateEffect,
  StateEffectType,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { iterate_with_cursor } from "dral-lezer-helpers";
import { compact } from "lodash";

/**
 * @typedef SelectorSpec
 * @type {{
 *  selector: string,
 * }}
 */

/** @type {StateEffectType<boolean>} */
const SetHasFocus = StateEffect.define({});
export const HasFocus = StateField.define({
  create() {
    return /** @type {boolean} */ (false);
  },
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(SetHasFocus)) {
        return effect.value;
      }
    }
    return value;
  },
});
export const HasFocusUpdater = EditorView.updateListener.of((update) => {
  if (update.startState.field(HasFocus, false) !== update.view.hasFocus) {
    update.view.dispatch({
      effects: [SetHasFocus.of(update.view.hasFocus)],
    });
  }
});

/**
 * @type {StateEffectType<SelectorSpec?>}
 */
const SetActiveSelector = StateEffect.define({});
export const ActiveSelector = StateField.define({
  create() {
    return /** @type {SelectorSpec?} */ (null);
  },
  update(value, tr) {
    let did_set_explicitly = false;
    for (let effect of tr.effects) {
      if (effect.is(SetActiveSelector)) {
        did_set_explicitly = true;
        return effect.value;
      }
    }

    if (
      tr.startState.field(HasFocus, false) === true &&
      tr.state.field(HasFocus, false) === false
    ) {
      return null;
    }

    if (
      tr.docChanged ||
      tr.newSelection !== tr.startState.selection ||
      did_set_explicitly ||
      tr.startState.field(HasFocus, false) !== tr.state.field(HasFocus, false)
    ) {
      let from = tr.state.selection.main.from;
      let to = tr.state.selection.main.to;
      let x = find_css_selector({
        doc: tr.state.doc,
        tree: syntaxTree(tr.state),
        from: from,
        to: to,
      });

      let selector_nodes = x.filter(
        (x) => x.type === "selector" && x.node.from <= from && to <= x.node.to
      );
      if (selector_nodes.length > 0) {
        return {
          selector: selector_nodes
            .map((selector_node) =>
              tr.state.sliceDoc(selector_node.node.from, selector_node.node.to)
            )
            .join(", "),
        };
      }

      return null;
    }

    return value;
  },
});

export function find_css_selector({ doc, tree, from, to }) {
  let things_to_return = [];

  iterate_with_cursor({
    tree,
    from,
    to,
    enter: (cursor) => {
      // `quote ... end` or `:(...)`
      if (cursor.name === "RuleSet") {
        let selectors = [];
        // RuleSet is `selector ("," selector)* Block` with no grouping on the selectors,
        // so I'll have to do "everything except Blocks" 🤷‍♀️
        if (cursor.firstChild()) {
          try {
            do {
              if (
                cursor.from <= to &&
                cursor.to >= from &&
                // @ts-ignore
                cursor.name !== "Block" &&
                // @ts-ignore
                cursor.name !== ","
              ) {
                selectors.push({
                  type: "selector",
                  node: cursor.node,
                });
              }
            } while (cursor.nextSibling());
          } finally {
            cursor.parent();
          }
        }
        things_to_return = [...things_to_return, ...selectors];
      }
    },
    leave: (cursor) => {},
  });

  // if (from !== to) {
  //   things_to_return = things_to_return.filter(
  //     (x) => x.node.to >= to && x.node.from <= from
  //   );
  // }

  return things_to_return;
}

/**
 * @param {EditorView} view
 */
function pkg_decorations(view) {
  let widgets = compact(
    view.visibleRanges.flatMap(({ from, to }) => {
      let things_to_mark = find_css_selector({
        doc: view.state.doc,
        tree: syntaxTree(view.state),
        from: from,
        to: to,
      });

      return things_to_mark.map((thing) => {
        if (thing.type === "selector") {
          let { node } = thing;
          let text = view.state.doc.sliceString(node.from, node.to);
          return Decoration.mark({
            tagName: "paintbrush-cm-selector",
            attributes: {
              // "title": `cmd-Click to jump to the definition of ${name}.`,
              // "data-cell-variable": name,
              "data-from": `${node.from}`,
              "data-to": `${node.to}`,
              // onClick: "console.log('x')",
              // onClick: () => {
              //   console.log("x");
              // },
            },
          }).range(node.from, node.to);
        } else {
          return null;
        }
      });
    })
  );

  return Decoration.set(widgets, true);
}

let DecorateSelectors = ViewPlugin.fromClass(
  class {
    /**
     * @param {EditorView} view
     */
    constructor(view) {
      this.decorations = pkg_decorations(view);
    }

    /**
     * @param {ViewUpdate} update
     */
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = pkg_decorations(update.view);
        return;
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      contextmenu: (event, view) => {
        // Eventually show a context menu with "scroll into view"
        // ... but for some reason it stopped working....
        // so you can try again later if you dare!!
      },
    },
  }
);

export const pkgBubblePlugin = () => [
  HasFocus,
  HasFocusUpdater,
  ActiveSelector,
  DecorateSelectors,
];
