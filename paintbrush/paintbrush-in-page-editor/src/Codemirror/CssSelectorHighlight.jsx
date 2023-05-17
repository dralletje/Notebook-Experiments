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
import { ContextMenu } from "../stuff/ContextMenu";

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
      let x = find_css_selector({
        doc: tr.state.doc,
        tree: syntaxTree(tr.state),
        from: tr.state.selection.main.from,
        to: tr.state.selection.main.to,
      });

      let selector_nodes = x.filter((x) => x.type === "selector");
      if (selector_nodes.length > 0) {
        console.log(`selector_nodes:`, selector_nodes);
        console.log(
          `selector_nodes.map((selector_node) =>
              tr.state.sliceDoc(selector_node.node.from, selector_node.node.to)
            ):`,
          selector_nodes.map((selector_node) =>
            tr.state.sliceDoc(selector_node.node.from, selector_node.node.to)
          )
        );
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
  let seen_packages = new Set();

  let widgets = view.visibleRanges
    .flatMap(({ from, to }) => {
      let things_to_mark = find_css_selector({
        doc: view.state.doc,
        tree: syntaxTree(view.state),
        from: from,
        to: to,
      });
      console.log(`things_to_mark:`, things_to_mark);

      return things_to_mark.map((thing) => {
        if (thing.type === "selector") {
          let { node } = thing;
          let text = view.state.doc.sliceString(node.from, node.to);
          console.log(`SELECTOR:`, text);
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
    .filter((x) => x != null);

  console.log(`widgets:`, widgets);
  // @ts-ignore
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
        let state = view.state;
        let target = /** @type {HTMLDivElement} */ (
          // @ts-ignore
          event.target.closest("paintbrush-cm-selector")
        );

        if (target == null) return false;

        view.dispatch({
          selection: {
            anchor: Number(target.dataset.from),
            head: Number(target.dataset.to),
          },
        });

        let x = find_css_selector({
          doc: state.doc,
          tree: syntaxTree(state),
          from: state.selection.main.from,
          to: state.selection.main.to,
        });

        let div = document.createElement("div");
        ReactDOM.render(
          <ContextMenu
            pageX={event.pageX}
            pageY={event.pageY}
            // @ts-ignore
            onBlur={() => {
              div.remove();
            }}
            options={[
              {
                title: "Scroll into view",
                onClick: () => {
                  window.parent.postMessage(
                    {
                      type: "scroll-into-view",
                      selector: target.innerText,
                    },
                    "*"
                  );
                  console.log("Scroll into view");
                },
              },
            ]}
          />,
          div
        );
        document.body.appendChild(div);

        return true;

        // let selector = target.textContent;
        // if (view.state.field(ActiveSelector, false)?.selector != selector) {
        //   view.dispatch({
        //     effects: [
        //       SetActiveSelector.of({
        //         selector: selector,
        //       }),
        //     ],
        //   });
        // }
      },
    },
    // eventHandlers: {
    //   pointerover: (e, view) => {
    //     // @ts-ignore
    //     let target = /** @type {HTMLDivElement} */ (
    //       e.target.closest("paintbrush-cm-selector")
    //     );
    //     if (target?.textContent != null) {
    //       let selector = target.textContent;
    //       if (view.state.field(ActiveSelector, false)?.selector != selector) {
    //         view.dispatch({
    //           effects: [
    //             SetActiveSelector.of({
    //               selector: selector,
    //             }),
    //           ],
    //         });
    //       }
    //     } else {
    //       if (view.state.field(ActiveSelector, false) != null) {
    //         view.dispatch({
    //           effects: [SetActiveSelector.of(null)],
    //         });
    //       }
    //     }
    //   },
    //   pointerleave: (event, view) => {
    //     if (view.state.field(ActiveSelector, false) != null) {
    //       view.dispatch({
    //         effects: [SetActiveSelector.of(null)],
    //       });
    //     }
    //   },
    // },
  }
);

export const pkgBubblePlugin = () => [
  HasFocus,
  HasFocusUpdater,
  ActiveSelector,
  DecorateSelectors,
];
