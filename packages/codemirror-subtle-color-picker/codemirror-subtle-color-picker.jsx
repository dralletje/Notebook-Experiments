import { Decoration, EditorView } from "@codemirror/view";
import { DecorationsFromTree } from "@dral/codemirror-helpers";
import React from "react";
import { ReactWidget, useEditorView } from "react-codemirror-widget";
import { ChromePicker } from "react-color";
import styled from "styled-components";

let FullscreenDialog = styled.dialog`
  /*
  max-height: unset;
  max-width: unset;
  height: 100%;
  width: 100%;
  */

  border: unset;
  background: unset;
  margin: unset;
  padding: unset;

  &::backdrop {
    background: none;
  }
`;

let Ughhhhh = styled.div`
  input {
    /* box-shadow: unset;
    color: white;
    font-family: inherit; */
    background-color: white;
  }
`;

let SubtleColorPicker = ({ from, to, color }) => {
  let editorview = useEditorView();

  /** @type {import("react").MutableRefObject<HTMLDialogElement>} */
  let dialog_ref = React.useRef(/** @type {any} */ (null));

  /** @type {import("react").MutableRefObject<HTMLButtonElement>} */
  let color_ref = React.useRef(/** @type {any} */ (null));

  return (
    <>
      <button
        ref={color_ref}
        className="cm-subtle-color-picker"
        style={{
          backgroundColor: color,
        }}
        onClick={() => {
          // Cool thing is, we can show the modal dialog,
          // measure its size, and then set the position afterwards!
          dialog_ref.current.showModal();

          let box = color_ref.current.getBoundingClientRect();
          let dialog_box = dialog_ref.current.getBoundingClientRect();

          let projected_top = box.bottom + 5;
          if (projected_top + dialog_box.height > window.innerHeight) {
            projected_top = box.top - dialog_box.height - 5;
          }

          let projected_left = box.left - 32;
          if (projected_left + dialog_box.width > window.innerWidth) {
            projected_left = window.innerWidth - dialog_box.width - 16;
          }

          dialog_ref.current.style.top = projected_top + "px";
          dialog_ref.current.style.left = projected_left + "px";
        }}
      ></button>
      <FullscreenDialog
        tabIndex={-1}
        ref={dialog_ref}
        style={{
          position: "absolute",
          outline: "1px solid #ffffff4f",
          borderRadius: 10,
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            dialog_ref.current.close();
          }
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            dialog_ref.current.close();
          }
        }}
      >
        <Ughhhhh>
          <ChromePicker
            styles={{
              default: {
                picker: {
                  backgroundColor: "rgb(32 33 36)",
                },
                alpha: {
                  backgroundColor: "white",
                  borderRadius: 2,
                },
                hue: {
                  borderRadius: 2,
                },
              },
            }}
            color={color}
            onChange={(color) => {
              editorview.dispatch({
                changes: {
                  from,
                  to,
                  insert: color.hex,
                },
              });
            }}
          />
        </Ughhhhh>
      </FullscreenDialog>
    </>
  );
};

let div_cache = null;
let ask_css_to_sanitize_color = (color) => {
  if (div_cache == null) {
    div_cache = document.createElement("div");
  }
  div_cache.style.color = "";
  div_cache.style.color = color;
  return div_cache.style.color;
};

export let codemirror_subtle_color_picker = [
  EditorView.baseTheme({
    ".cm-subtle-color-picker": {
      all: "unset",

      display: "inline-block",
      height: "1em",
      width: "1em",
      "margin-right": "5px",
      "margin-left": "2px",
      cursor: "pointer",
      transform: "translateY(3px)",
      "border-radius": "2px",
    },
  }),
  DecorationsFromTree(({ cursor, mutable_decorations, doc }) => {
    if (cursor.name === "String") {
      let text_from = cursor.from + 1;
      let text_to = cursor.to - 1;

      let text = doc.sliceString(text_from, text_to);
      if (text.startsWith(" ") || text.endsWith(" ")) return;
      let color = ask_css_to_sanitize_color(text);

      if (color != "") {
        mutable_decorations.push(
          Decoration.widget({
            block: false,
            widget: new ReactWidget(
              (
                <SubtleColorPicker
                  key="subtle-color-picker"
                  from={text_from}
                  to={text_to}
                  color={color}
                />
              )
            ),
          }).range(cursor.from + 1, cursor.from + 1)
        );
      }
    }
  }),
];
