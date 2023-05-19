import { css, cssLanguage } from "@codemirror/lang-css";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { Tag, styleTags, tags } from "@lezer/highlight";

let syntax_classes = EditorView.theme({
  // Default font color:
  ".cm-content": {
    color: "#655d8d",
  },

  // Repeated so specificity is increased...
  // I need this to show the colors in the selected autocomplete...
  // TODO Ideally I'd just do a custom render or something on the autocomplete
  ".boring.boring.boring": {
    color: "#655d8d",
  },
  ".very-important.very-important.very-important": {
    color: "#f3f1f1",
    fontWeight: 700,
  },
  ".important.important.important": {
    color: "#f3f1f1",
  },
  ".property.property.property": {
    color: "#cb00d7",
  },
  ".variable.variable.variable": {
    color: "#a16fff",
  },
  ".literal.literal.literal": {
    color: "#00a7ca",
  },
  ".comment.comment.comment": {
    color: "#747474",
    fontStyle: "italic",
  },
});

let css_tags = {
  tagSelector: Tag.define(),
  classSelector: Tag.define(),
  idSelector: Tag.define(),
  attributeSelector: Tag.define(),
  pseudoSelector: Tag.define(),
};

const css_colors = HighlightStyle.define(
  [
    { tag: tags.propertyName, class: "property" },
    { tag: tags.variableName, class: "variable" },
    { tag: tags.definitionKeyword, class: "very-important" },
    { tag: tags.modifier, class: "important" },
    { tag: tags.operatorKeyword, class: "important" },
    { tag: tags.literal, class: "literal" },
    { tag: tags.unit, class: "literal" },
    { tag: tags.atom, class: "literal" },

    { tag: tags.punctuation, class: "boring" },

    { tag: css_tags.tagSelector, color: "#ff9231" },
    { tag: css_tags.classSelector, color: "#ff9231", fontWeight: "bold" },
    { tag: css_tags.idSelector, color: "#ff9231", fontWeight: "bold" },
    { tag: css_tags.attributeSelector, fontWeight: "bold" },

    // { tag: tags.constant(tags.className), class: "very-important" },
    { tag: tags.comment, class: "comment" },
  ],
  { scope: cssLanguage }
);

export let dral_css = () => {
  return [
    syntax_classes,
    // @ts-ignore
    css().language.configure({
      props: [
        styleTags({
          "AttributeSelector/...": css_tags.attributeSelector,
          "ClassSelector!": css_tags.classSelector,
          "IdSelector!": css_tags.idSelector,
          "TagSelector!": css_tags.tagSelector,
          // "AttributeSelector!": tags.labelName,
        }),
      ],
    }),
    syntaxHighlighting(css_colors),
  ];
};
