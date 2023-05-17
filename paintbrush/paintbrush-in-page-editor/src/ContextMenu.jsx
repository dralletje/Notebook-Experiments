import React from "react";
import styled from "styled-components";

let ContextMenuStyle = styled.div`
  z-index: 100;

  /*
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: start;
  */

  .menu {
    min-width: 170px;
    background-color: #eee;
    background-color: #8b8b8b;
    color: white;

    border-radius: 4px;

    flex-direction: column;
    align-items: stretch;
    display: flex;
    font-family: sans-serif;

    padding: 4px 0;
    font-size: 15px;

    border: solid 1px rgba(0, 0, 0, 0.2);
    box-shadow: rgba(0, 0, 0, 0.8) 0px 1px 11px -4px;

    position: sticky;
    bottom: 0;
  }

  .menu:focus {
    outline: none;
  }

  button {
    all: unset;
    padding: 0px 16px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: unset;
  }
  button:not([disabled]):hover {
    background-color: white;
    background-color: #d8e5ff;
    background-color: #5c77ff;
  }
`;

let Dialog = styled.dialog`
  &::backdrop {
    background-color: rgba(0, 0, 0, 0);
  }
  border: none;
  background: none;
  margin: 0;
  padding: 0;
`;

export let ContextMenu = ({ pageY, pageX, options, onBlur = null }) => {
  let context_ref = React.useRef(null);
  /** @type {import("react").MutableRefObject<HTMLDialogElement>} */
  let dialog_ref = React.useRef(/** @type {any} */ (null));
  // React.useLayoutEffect(() => {
  //   console.log('context_ref:', context_ref);
  //   context_ref.current.focus();
  // }, [layerX, layerY]);

  React.useEffect(() => {
    dialog_ref.current.style.top = `${pageY}px`;
    dialog_ref.current.style.left = `${pageX}px`;
    dialog_ref.current.showModal();

    let rect = dialog_ref.current.getBoundingClientRect();

    // Outside of the viewport on the right side
    let sticking_out = rect.right - (window.innerWidth - 16);
    if (sticking_out > 0) {
      // prettier-ignore
      dialog_ref.current.style.left = `${pageX - sticking_out}px`;
    }

    // Outside of the viewport on the bottom
    let sticking_out_bottom = rect.bottom - (window.innerHeight - 4);
    if (sticking_out_bottom > 0) {
      dialog_ref.current.style.top = `${pageY - sticking_out_bottom}px`;

      // // See if moving to above would be beneficial
      // let space_below = window.innerHeight - span_position.bottom;
      // let space_above = span_position.top;

      // if (space_below < space_above) {
      //   // prettier-ignore
      //   dialog_ref.current.style.top = `${span_position.top - rect.height}px`;
      // } else {
      //   // Keep below
      //   dialog_ref.current.style.maxHeight = `${space_below - 16}px`;
      // }
    }
  });

  return (
    <Dialog ref={dialog_ref}>
      <ContextMenuStyle
      // style={{
      //   position: "fixed",
      //   top: pageY,
      //   left: pageX,
      //   transform: [
      //     flipVertical && "translateY(-100%)",
      //     flipHorizontal && "translateX(-100%)",
      //   ]
      //     .filter(Boolean)
      //     .join(" "),
      // }}
      >
        <div
          className="menu"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          tabIndex={0}
          // ref={(ref) => {
          //   if (ref) ref.focus();
          //   context_ref.current = ref;
          // }}
          ref={context_ref}
          onBlur={() => {
            dialog_ref.current.close();
            onBlur?.();
          }}
        >
          {options.map((option, index) => (
            <button
              key={index}
              disabled={option.disabled}
              className="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                option.onClick(event);
                context_ref.current.blur();
              }}
            >
              {option.title}
            </button>
          ))}
        </div>
      </ContextMenuStyle>
    </Dialog>
  );
};

export let ContextMenuWrapper = ({
  options = [],
  children,
  disabled = false,
  flipHorizontal = false,
  flipVertical = false,
}) => {
  let [context_open, set_context_open] = React.useState(
    /** @type {{ pageX: number, pageY: number }?} */ (null)
  );

  return (
    <div
      style={{
        display: "contents",
      }}
      onContextMenu={(event) => {
        // let root_node = event.target.getRootNode();
        // let activeElement = root_node.activeElement;
        // console.log('activeElement:', activeElement);
        // console.log('event.target:', event.target);

        // if (
        //   root_node !== activeElement &&
        //   (activeElement === event.target ||
        //     (activeElement && activeElement.contains(event.target)))
        // ) {
        //   return;
        // }
        if (event.metaKey) return;
        if (disabled) return;
        if (!options || options.length === 0) return;

        event.preventDefault();
        set_context_open({
          pageX: event.pageX,
          pageY: event.pageY,
        });
      }}
    >
      {context_open && (
        <ContextMenu
          pageY={context_open.pageY}
          pageX={context_open.pageX}
          flipHorizontal={flipHorizontal}
          flipVertical={flipVertical}
          options={options}
          onBlur={() => set_context_open(null)}
        />
      )}
      {children}
    </div>
  );
};
