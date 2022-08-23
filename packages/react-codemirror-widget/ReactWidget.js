import { createElement, createContext, useContext } from "react";
import ReactDOM from "react-dom";
import { WidgetType } from "@codemirror/view";

export let EditorViewContext = createContext(null);

export let useEditorView = () => useContext(EditorViewContext);

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
    return false;
  }

  toDOM(view) {
    this.view = view;
    let span = document.createElement("span");
    ReactDOM.render(
      createElement(
        EditorViewContext.Provider,
        { value: this.view },
        this.element
      ),
      span
    );
    return span;
  }

  updateDOM(dom) {
    ReactDOM.render(
      createElement(
        EditorViewContext.Provider,
        { value: this.view },
        this.element
      ),
      dom
    );
    return true;
  }
}
