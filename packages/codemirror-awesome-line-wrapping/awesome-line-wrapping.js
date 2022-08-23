/**
 * Plugin that makes line wrapping in the editor respect the identation of the line.
 * It does this by adding a line decoration that adds padding-left (as much as there is indentation),
 * and adds the same amount as negative "text-indent". The nice thing about text-indent is that it
 * applies to the initial line of a wrapped line.
 *
 * The identation decorations have to happen in a StateField (without access to the editor),
 * because they change the layout of the text :( The character width I need however, is in the editor...
 * So I do this ugly hack where I, in `character_width_listener`, I fire an effect that gets picked up
 * by another StateField (`extra_cycle_character_width`) that saves the character width into state,
 * so THEN I can add the markers in the decorations statefield.
 */

import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { range } from "lodash";
import { createElement } from "react";
import { ReactWidget, useEditorView } from "react-codemirror-widget";

/** @type {any} */
const CharacterWidthEffect = StateEffect.define({});
const extra_cycle_character_width = StateField.define({
  create() {
    return {
      defaultCharacterWidth: null,
      measuredSpaceWidth: null,
      measuredTabWidth: null,
    };
  },
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(CharacterWidthEffect)) return effect.value;
    }
    return value;
  },
});

let character_width_listener = EditorView.updateListener.of((viewupdate) => {
  let width = viewupdate.view.defaultCharacterWidth;
  let { defaultCharacterWidth } = viewupdate.view.state.field(
    extra_cycle_character_width,
    false
  ) ?? { defaultCharacterWidth: null };

  // I assume that codemirror will notice if text size changes,
  // so only then I'll also re-measure the space width.
  if (defaultCharacterWidth !== width) {
    // Tried to adapt so it would always use the dummy line (with just spaces), but it never seems to work
    // https://github.com/codemirror/view/blob/41eaf3e1435ec62ecb128f7e4b8d4df2a02140db/src/docview.ts#L324-L343
    // I guess best to first fix defaultCharacterWidth in CM6,
    // but eventually we'll need a way to actually measures the identation of the line.
    // Hopefully this person will respond:
    // https://discuss.codemirror.net/t/custom-dom-inline-styles/3563/10
    let space_width;
    let tab_width;
    // @ts-ignore

    viewupdate.view.dispatch({
      effects: [
        CharacterWidthEffect.of({
          defaultCharacterWidth: width,
          measuredSpaceWidth: space_width,
          measuredTabWidth: tab_width,
        }),
      ],
    });
  }
});

let ARBITRARY_INDENT_LINE_WRAP_LIMIT = 8;
let line_wrapping_decorations = StateField.define({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    // let tabSize = tr.state.tabSize
    let tabSize = 4;
    let previous = tr.startState.field(extra_cycle_character_width, false) ?? {
      measuredSpaceWidth: null,
      defaultCharacterWidth: null,
    };
    let previous_space_width =
      previous.measuredSpaceWidth ?? previous.defaultCharacterWidth;
    let { measuredSpaceWidth, defaultCharacterWidth } = tr.state.field(
      extra_cycle_character_width,
      false
    ) ?? { measuredSpaceWidth: null, defaultCharacterWidth: null };
    let space_width = measuredSpaceWidth ?? defaultCharacterWidth;

    if (space_width == null) return Decoration.none;
    if (
      !tr.docChanged &&
      deco !== Decoration.none &&
      previous_space_width === space_width
    )
      return deco;

    let decorations = [];

    // TODO? Only apply to visible lines? Wouldn't that screw stuff up??
    // TODO? Don't create new decorations when a line hasn't changed?
    for (let i of range(0, tr.state.doc.lines)) {
      let line = tr.state.doc.line(i + 1);
      if (line.length === 0) continue;

      let indented_tabs = 0;
      for (let ch of line.text) {
        if (ch === "\t") {
          indented_tabs++;
          // For now I ignore spaces... because they are weird... and stupid!
          // } else if (ch === " ") {
          //     indented_chars = indented_chars + 1
          //     indented_text_characters++
        } else {
          break;
        }
      }

      const characters_to_count = Math.min(
        indented_tabs,
        ARBITRARY_INDENT_LINE_WRAP_LIMIT
      );
      const offset = characters_to_count * tabSize * space_width;

      const linerwapper = Decoration.line({
        attributes: {
          // style: rules.cssText,
          style: `--indented: ${offset}px;`,
          class: "awesome-wrapping-plugin-the-line",
        },
      });
      // Need to push before the tabs one else codemirror gets madddd
      decorations.push(linerwapper.range(line.from, line.from));

      if (characters_to_count !== 0) {
        decorations.push(
          Decoration.mark({
            class: "awesome-wrapping-plugin-the-tabs",
          }).range(line.from, line.from + characters_to_count)
        );
      }
      if (indented_tabs > characters_to_count) {
        for (let i of range(characters_to_count, indented_tabs)) {
          decorations.push(
            Decoration.replace({
              widget: new ReactWidget(
                createElement("span", { style: { opacity: 0.2 } }, "⇥ ")
              ),
              block: false,
            }).range(line.from + i, line.from + i + 1)
          );
        }
      }

      // let tabs_in_front = Math.min(line.text.match(/^\t*/)[0].length) * tabSize

      // TODO? Cache the CSSStyleDeclaration?
      // This is used when we don't use a css class, but we do need a css class because
      // text-indent normally cascades, and we have to prevent that.
      // const rules = document.createElement("span").style
      // rules.setProperty("--idented", `${offset}px`)
      // rules.setProperty("text-indent", "calc(-1 * var(--idented) - 1px)") // I have no idea why, but without the - 1px it behaves weirdly periodically
      // rules.setProperty("padding-left", "calc(var(--idented) + var(--cm-left-padding, 4px))")
    }
    return Decoration.set(decorations);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Add this back in
// let dont_break_before_spaces_matcher = new MatchDecorator({
//     regexp: /[^ \t]+[ \t]+/g,
//     decoration: Decoration.mark({
//         class: "indentation-so-dont-break",
//     }),
// })

let identation_so_dont_break_marker = Decoration.mark({
  class: "indentation-so-dont-break",
});

let dont_break_before_spaces = StateField.define({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    let decorations = [];
    let pos = 0;
    for (const line of tr.newDoc) {
      for (const match of /** @type{string} */ (line).matchAll(
        /[^ \t]+([ \t]|$)+/g
      )) {
        if (match.index == null || match.index === 0) continue; // Sneaky negative lookbehind
        decorations.push(
          identation_so_dont_break_marker.range(
            pos + match.index,
            pos + match.index + match[0].length
          )
        );
      }
    }
    return Decoration.set(decorations, true);
  },
  provide: (f) => EditorView.decorations.from(f),
});

let base_theme = EditorView.baseTheme({
  ".awesome-wrapping-plugin-the-line": {
    "--correction": 0,
    "margin-left": "calc(var(--indented))",
    "text-indent": "calc(-1 * var(--indented))",
  },
  ".awesome-wrapping-plugin-the-line > *": {
    /* text-indent apparently cascades... which I think is pretty stupid but this is the fix */
    "text-indent": "initial",
  },
  ".awesome-wrapping-plugin-the-tabs": {
    /* So FOR SOME REASON text-ident is kinda buggy
        but that gets fixed with inline-block...  
        But that brought some other problems...
        But margin-left: -1px seems to also do the trick?? */
    /* display: inline-block; */
    whiteSpace: "pre",
    verticalAlign: "top",
    marginLeft: "-1px",
  },
});

export let awesome_line_wrapping = [
  base_theme,
  extra_cycle_character_width,
  character_width_listener,
  line_wrapping_decorations,
];
