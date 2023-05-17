import React from "react";
import styled from "styled-components";

let Dialog = styled.dialog`
  &::backdrop {
    background-color: rgba(0, 0, 0, 0);
  }
  border: none;
  background: none;
  padding: 0;

  margin-left: -16px;
  padding: 4px 4px;

  background-color: white;
  color: black;

  --border-radius: 8px;
  border-radius: var(--border-radius);
`;
let Container = styled.div``;
let Option = styled.div`
  /* padding: 0 16px; */
  padding: 0 12px;
  border-radius: var(--border-radius);

  &:hover {
    background-color: black;
    color: white;
  }
`;

let SpanContainer = styled.span`
  user-select: none;
  display: inline-block;
`;

let HoverSpanContainer = styled(SpanContainer)`
  &:hover {
    text-decoration: underline;
    text-decoration-thickness: 4px;
  }
`;

export let SubtleDropdown = ({
  value,
  onChange,
  style = undefined,
  options,
}) => {
  let current_option = options.find(
    (value_option) => value_option.value === value
  );

  let dialog_ref = React.useRef(
    /** @type {HTMLDialogElement} */ (/** @type {any} */ (null))
  );
  let current_span_ref = React.useRef(
    /** @type {HTMLSpanElement} */ (/** @type {any} */ (null))
  );

  return (
    <>
      <HoverSpanContainer
        ref={current_span_ref}
        style={style}
        onClick={() => {
          let span_position = current_span_ref.current.getBoundingClientRect();
          dialog_ref.current.style.top = `${span_position.bottom}px`;
          dialog_ref.current.style.left = `${span_position.left}px`;
          dialog_ref.current.showModal();

          let rect = dialog_ref.current.getBoundingClientRect();

          // Outside of the viewport on the right side
          let sticking_out = rect.right - (window.innerWidth - 16);
          if (sticking_out > 0) {
            // prettier-ignore
            dialog_ref.current.style.left = `${span_position.left - sticking_out}px`;
          }

          // Outside of the viewport on the bottom
          let sticking_out_bottom = rect.bottom - (window.innerHeight - 16);
          if (sticking_out_bottom > 0) {
            // See if moving to above would be benificial
            let space_below = window.innerHeight - span_position.bottom;
            let space_above = span_position.top;

            if (space_below < space_above) {
              // prettier-ignore
              dialog_ref.current.style.top = `${span_position.top - rect.height}px`;
            } else {
              // Keep below
              dialog_ref.current.style.maxHeight = `${space_below - 16}px`;
            }
          }
        }}
      >
        {current_option.label}
      </HoverSpanContainer>
      <Dialog
        ref={dialog_ref}
        onClick={(event) => {
          if (event.target === dialog_ref.current) {
            dialog_ref.current.close();
          }
        }}
      >
        <Container>
          {options.map((option) => (
            <Option
              key={option.value}
              onClick={() => {
                onChange(option.value);
                dialog_ref.current.close();
              }}
            >
              <SpanContainer style={style}>{option.label}</SpanContainer>
            </Option>
          ))}
        </Container>
      </Dialog>
    </>
  );
};
