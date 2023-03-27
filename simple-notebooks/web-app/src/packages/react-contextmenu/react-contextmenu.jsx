import React from "react";
import styled from "styled-components";

export let ContextMenuContainer = styled.div`
  .menu {
    user-select: none;

    min-width: 170px;
    background: #25252588;
    backdrop-filter: blur(30px);
    color: white;

    border-radius: 4px;

    display: flex;
    flex-direction: column;
    align-items: stretch;
    font-family: sans-serif;

    padding: 8px 0;
    gap: 6px;
    font-size: 15px;

    border: solid 1px rgba(0, 0, 0, 0.2);
    box-shadow: rgba(0, 0, 0, 0.8) 0px 1px 11px -4px;

    position: sticky;
    bottom: 0;
    border: solid 0.5px #ffffff47;
  }

  .menu:focus {
    outline: none;
  }

  button {
    all: unset;
    padding: 0px 16px;
    /* cursor: pointer; */
    position: relative;
  }
  button:disabled {
    opacity: 0.5;
    cursor: unset;
  }

  button::after {
    content: "";
    position: absolute;
    inset: -3px 0;
    z-index: -1;
  }

  button:not([disabled]):hover::after {
    background-color: white;
    background-color: #d8e5ff;
    background-color: #5c77ff;
  }
`;

let ContextMenuDialog = styled.dialog`
  border: none;
  background: transparent;
  max-width: unset;
  max-height: unset;
  margin: 0px;
  padding: 0px;

  &::backdrop {
    background: transparent;
  }
`;

export let ContextMenu = ({ options, onBlur = () => {} }) => {
  let context_ref = React.useRef(null);
  // React.useLayoutEffect(() => {
  //   console.log('context_ref:', context_ref);
  //   context_ref.current.focus();
  // }, [layerX, layerY]);

  return (
    <ContextMenuContainer
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
        ref={(ref) => {
          if (ref) ref.focus();
          context_ref.current = ref;
        }}
        onBlur={() => {
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
              onBlur();
            }}
          >
            {option.title}
          </button>
        ))}
      </div>
    </ContextMenuContainer>
  );
};

export let ContextMenuWrapper = ({
  options = [],
  children,
  disabled = false,
}) => {
  let [context_open, set_context_open] = React.useState(null);

  /** @type {import("react").MutableRefObject<HTMLDialogElement>} */
  let dialog_ref = React.useRef(/** @type {any} */ (null));

  return (
    <React.Fragment>
      <ContextMenuDialog
        ref={dialog_ref}
        onClick={(event) => {
          if (event.target === dialog_ref.current) {
            dialog_ref.current.close();
          }
        }}
      >
        <ContextMenu
          options={options}
          onBlur={() => {
            dialog_ref.current.close();
          }}
        />
      </ContextMenuDialog>

      <div
        style={{
          display: "contents",
        }}
        onContextMenu={(event) => {
          if (dialog_ref.current.open) {
            return;
          }

          if (event.metaKey) return;
          if (disabled) return;
          if (!options || options.length === 0) return;

          event.preventDefault();
          let top = event.clientY - 4;
          let left = event.clientX + 2;

          // let span_position = current_span_ref.current.getBoundingClientRect();
          dialog_ref.current.style.top = `${top}px`;
          dialog_ref.current.style.left = `${left}px`;
          dialog_ref.current.showModal();

          let rect = dialog_ref.current.getBoundingClientRect();

          // Outside of the viewport on the right side
          let sticking_out = rect.right - (window.innerWidth - 16);
          if (sticking_out > 0) {
            // prettier-ignore
            dialog_ref.current.style.left = `${left - sticking_out}px`;
          }

          // Outside of the viewport on the bottom
          let sticking_out_bottom = rect.bottom - (window.innerHeight - 16);
          if (sticking_out_bottom > 0) {
            // See if moving to above would be benificial
            let space_below = window.innerHeight - top;
            let space_above = top;

            if (space_below < space_above) {
              // prettier-ignore
              dialog_ref.current.style.top = `${top - rect.height + space_below}px`;
            } else {
              // Keep below
              dialog_ref.current.style.maxHeight = `${space_below - 16}px`;
            }
          }
        }}
      >
        {children}
      </div>
    </React.Fragment>
  );
};

/**
 * @param {{
 *  icon: import("react").ReactElement,
 *  label: string,
 *  shortcut?: string,
 * }} props
 */
export let ContextMenuItem = ({ icon, label, shortcut }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        whiteSpace: "pre",
      }}
    >
      <span style={{ flex: "0 1 content", transform: "translateY(2px)" }}>
        {icon}
      </span>
      <div style={{ minWidth: 8 }} />
      <span>{label}</span>
      <div style={{ flex: "1 0 40px" }} />
      {shortcut && (
        <div style={{ opacity: 0.5, fontSize: "0.8em" }}>{shortcut}</div>
      )}
    </div>
  );
};
