/**
 * Works better than I was expecting...
 * Now for how to actually make it useful within the editor... 🤷‍♀️
 */

import { EditorState, Range, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { iterate_with_cursor } from "dral-lezer-helpers";
import {
  js,
  t,
  template,
  create_specific_template_maker,
  js_dynamic,
} from "lezer-template";

/**
 * @param {Parameters<create_specific_template_maker>[0]} template_creator
 */
let make_beautiful_specific_matcher = (template_creator) => {
  let template_fn = create_specific_template_maker(template_creator);
  return function match(cursor, verbose = false) {
    if (cursor == null) {
      /** @type {(...args: Parameters<js>) => any} */
      return (x, ...args) => {
        return template_fn(js(x, ...args));
      };
    }

    /** @type {(...args: Parameters<js>) => any} */
    return function jl_and_match(x, ...args) {
      return template_fn(js(x, ...args)).match(cursor, verbose);
    };
  };
};
let object_entry = make_beautiful_specific_matcher(
  (x) => js_dynamic`({ ${x} })`
);

let get_decorations = (
  /** @type {EditorState} */ state,
  /** @type {Array<Range<Decoration>>} */ previous_decorations
) => {
  /** @type {Array<Range<Decoration>>} */
  let decorations = [];

  // NOTE Iterating with cursor is fun and all, but also error prone.
  // .... Because it can depend on content before it to know if it is
  // .... a label, or actually an object property, for example...
  // .... Going back to searching for comments.. :/
  let tree = syntaxTree(state);
  iterate_with_cursor({
    tree: tree,
    enter: (cursor) => {
      let match = null;

      // console.log(`cursor:`, cursor);
      if (
        (match = template(js`
          ${t.as("name", t.VariableName)}(${t.String})
        `).match(cursor, true)) ||
        (match = template(js`
          ${t.as("name", t.VariableName)}(${t.String}, {
            ${t.many("properties", t.anything_that_fits(js`x: y`))}
          })
        `).match(cursor, true))
      ) {
        let { name, properties } = match;
        if (state.sliceDoc(name.from, name.to) !== "interactive") return;
        console.log(`match:`, match);
        console.log(`properties:`, properties);
      }
    },
  });

  return decorations;
};

let decorations = StateField.define({
  create(state) {
    return get_decorations(state, []);
  },
  update(previous, tr) {
    if (tr.docChanged) {
      return get_decorations(tr.state, previous);
    } else {
      return previous;
    }
  },
  provide: (field) =>
    EditorView.decorations.from(field, (x) => Decoration.set(x)),
});

export let codemirror_interactive = [decorations];
