import {
  createElement,
  createContext,
  useContext,
  isValidElement,
} from "react";
import { createRoot } from "react-dom/client";
import { EditorView, GutterMarker, WidgetType } from "@codemirror/view";

export let EditorViewContext = createContext(
  /** @type {EditorView} */ (/** @type {any} */ (null))
);

export let useEditorView = () => {
  let view = useContext(EditorViewContext);
  if (view == null) {
    // prettier-ignore
    throw new Error(`EditorView is null in \`useEditorView\`, for some reason...`)
  }
  return view;
};

let codemirror_view_symbol = Symbol("Codemirror view");
let react_root_symbol = Symbol("React root");
let element_key_symbol = Symbol("Element key");

/**
 * Use this Widget to render (P)react components as codemirror widgets.
 */
export class ReactWidget extends WidgetType {
  /** @param {import("react").ReactNode} element */
  constructor(element) {
    super();
    this.element = element;
  }

  eq(other) {
    return false;
  }

  toDOM(view) {
    this.view = view;
    let span = document.createElement("span");
    let root = createRoot(span);
    root.render(
      createElement(
        EditorViewContext.Provider,
        { value: this.view },
        this.element
      )
    );
    span[codemirror_view_symbol] = view;
    span[react_root_symbol] = root;
    if (isValidElement(this.element))
      span[element_key_symbol] = this.element.key;

    return span;
  }

  updateDOM(dom) {
    if (dom[react_root_symbol] == null) return false;
    if (dom[codemirror_view_symbol] == null) return false;

    if (
      isValidElement(this.element) &&
      (this.element.key == null || dom[element_key_symbol] !== this.element.key)
    )
      return false;

    if (Array.isArray(this.element)) return false;

    dom[react_root_symbol].render(
      createElement(
        EditorViewContext.Provider,
        { value: dom[codemirror_view_symbol] },
        this.element
      )
    );
    return true;
  }
}

/**
 * Use this GutterMarker to render (P)react components as codemirror widgets.
 */
export class ReactGutterMarker extends GutterMarker {
  /** @param {import("react").ReactElement} element */
  constructor(element) {
    super();
    this.element = element;
  }

  eq(other) {
    return (
      this.element.key != null &&
      this.element.type === other.element.type &&
      this.element.key === other.element.key
    );
  }

  toDOM(view) {
    this.view = view;
    let span = document.createElement("span");
    let root = createRoot(span);
    root.render(
      createElement(
        EditorViewContext.Provider,
        { value: this.view },
        this.element
      )
    );
    return span;
  }
}
