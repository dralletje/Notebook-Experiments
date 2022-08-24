import { createElement, createContext, useContext } from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { EditorView, WidgetType } from "@codemirror/view";

export let EditorViewContext = createContext(
  /** @type {EditorView} */ (/** @type {any} */ (null))
);

export let useEditorView = () => useContext(EditorViewContext);

let codemirror_view_symbol = Symbol("Codemirror view");
let react_root_symbol = Symbol("React root");
let element_key_symbol = Symbol("Element key");

/**
 * Use this Widget to render (P)react components as codemirror widgets.
 */
export class ReactWidget extends WidgetType {
  /** @param {import("react").ReactElement} element */
  constructor(element) {
    super();
    this.element = element;
  }

  eq(other) {
    // TODO Maybe compare if it has the exact same element?
    return false;
  }

  toDOM(view) {
    console.log("TO DOM!");

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
    span[element_key_symbol] = this.element.key;
    return span;
  }

  updateDOM(dom) {
    if (dom[react_root_symbol] == null) return false;
    if (dom[codemirror_view_symbol] == null) return false;
    if (dom[element_key_symbol] !== this.element.key) return false;

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
