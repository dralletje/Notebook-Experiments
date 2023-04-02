import React from "react";
import { ReactWidget, useEditorView } from "@dral/react-codemirror-widget";
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

let Button = styled.button`
  all: unset;

  display: inline-block;
  height: 1em;
  width: 1em;
  margin-right: 5px;
  margin-left: 2px;
  cursor: pointer;
  transform: translateY(3px);
  border-radius: 2px;
`;

let Ughhhhh = styled.div`
  input {
    /* box-shadow: unset;
    color: white;
    font-family: inherit; */
    background-color: white;
  }
`;

export let SubtleColorPicker = ({
  from,
  to,
  color,
}: {
  from: number;
  to: number;
  color: string;
}) => {
  let editorview = useEditorView();

  let dialog_ref = React.useRef(null as any as HTMLDialogElement);
  let color_ref = React.useRef(null as any as HTMLButtonElement);

  return (
    <>
      <Button
        ref={color_ref}
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
      />
      <FullscreenDialog
        tabIndex={-1}
        ref={dialog_ref}
        style={{
          position: "absolute",
          outline: "1px solid #ffffff4f",
          borderRadius: 10,
        }}
        onBlur={(event: FocusEvent) => {
          // @ts-ignore
          if (!event.currentTarget?.contains?.(event.relatedTarget)) {
            dialog_ref.current.close();
          }
        }}
        onMouseDown={(event: Event) => {
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
            onChange={(color: { hex: string }) => {
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

let div_cache: HTMLDivElement | null = null;
export let ask_css_to_sanitize_color = (color: string) => {
  if (div_cache == null) {
    div_cache = document.createElement("div");
  }
  div_cache.style.color = "";
  div_cache.style.color = color;
  return div_cache.style.color;
};

export class ColorPickerWidget extends ReactWidget {
  from: number;
  to: number;
  color: string;

  constructor(from: number, to: number, color: string) {
    super(
      // I AM SO SORRY ABOUT THIS
      // But @vitejs/plugin-react-swc changes this JSX fragment to something
      // that contains `this`... and I can't use `this` before `super()`!
      // So I have to use an IIFE that has it's own `this`.
      (function () {
        return (
          <SubtleColorPicker
            key="subtle-color-picker"
            from={from}
            to={to}
            color={color}
          />
        );
      })()
    );

    this.from = from;
    this.to = to;
    this.color = color;
  }

  eq(other: ColorPickerWidget) {
    return (
      this.from === other.from &&
      this.to === other.to &&
      this.color === other.color
    );
  }
}
