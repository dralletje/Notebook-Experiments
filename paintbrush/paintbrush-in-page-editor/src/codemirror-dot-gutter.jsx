import { EditorView, gutter, GutterMarker } from "@codemirror/view";

export let subtle_gutter = EditorView.theme({
  ".cm-gutters": {
    "background-color": "transparent",
    "border-right": "none",
  },
});

class DotGutter extends GutterMarker {
  constructor(/** @type {number} */ line) {
    super();
  }
  eq() {
    return true;
  }
  toDOM() {
    let dom = document.createElement("div");
    dom.className = "dot-gutter";
    return dom;
  }
}

export let dot_gutter = [
  EditorView.theme({
    ".dot-gutter": {
      "margin-top": "10px",
      width: "5px",
      height: "5px",
      "margin-left": "6px",
      "margin-right": "6px",
      "background-color": "#ffffff38",
      "border-radius": "3px",
    },
  }),
  subtle_gutter,
  gutter({
    lineMarker: (view, line) => new DotGutter(),
    // TODO This unlocks some cool stuff, but also makes the editor space out because it renders them async?
    // .... idk it's weird investigate this
    // lineMarker: (view, line) =>
    //   new ReactGutterMarker(<div className="dot-gutter"></div>),
  }),
];
