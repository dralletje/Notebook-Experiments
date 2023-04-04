// Basically copied from https://github.com/fonsp/Pluto.jl/blob/ab85efca962d009c741d4ec66508d687806e9579/frontend/components/SelectionArea.js
// Couple of tweaks

// TODO Kill me
/// <reference path="custom-tags.d.ts" />

import React from "react";
import styled from "styled-components";

const get_element_position_in_document = (element) => {
  let top = 0;
  let left = 0;

  do {
    top += element.offsetTop || 0;
    left += element.offsetLeft || 0;
    element = element.offsetParent;
  } while (element);

  return {
    top: top,
    left: left,
  };
};

const in_request_animation_frame = (fn) => {
  let last_known_arguments = null;
  let ticking = false;

  return (...args) => {
    last_known_arguments = args;
    if (!ticking) {
      window.requestAnimationFrame(() => {
        fn(...last_known_arguments);
        ticking = false;
      });

      ticking = true;
    }
  };
};

/**
 *
 * @typedef Coordinate2D
 * @property {number} x
 * @property {number} y
 */

/**
 * @param {{ on_selection: (selection: string[]) => void, children: import("react").ReactNode }} props
 * @returns {import("react").ReactElement}
 */
export const SelectionArea = ({ on_selection, children }) => {
  /** @type {import("react").MutableRefObject<MouseEvent | null>} */
  const mouse_position_ref = React.useRef(null);
  const is_selecting_ref = React.useRef(false);
  const element_ref = React.useRef(
    /** @type {HTMLDivElement} */ (/** @type {any} */ (null))
  );

  const [selection, set_selection] = React.useState(
    /** @type {{start: Coordinate2D, end: Coordinate2D}?} */ (null)
  );

  const onmousedown = (/** @type {import("react").MouseEvent} */ e) => {
    let target = /** @type {HTMLElement} */ (e.target);

    // TODO: also allow starting the selection in one codemirror and stretching it to another cell
    if (
      !e?.defaultPrevented &&
      element_ref.current.contains(target) &&
      e.button === 0 &&
      // @ts-ignore
      target.closest("[data-can-start-selection]")?.dataset
        ?.canStartSelection !== "false"
    ) {
      e.preventDefault();
      console.log(
        `target.closest("[tabindex]"):`,
        target.closest("[tabindex]")
      );
      target.closest("[tabindex]")?.focus();
      on_selection([]);
      set_selection({
        start: { x: e.pageX, y: e.pageY },
        end: { x: e.pageX, y: e.pageY },
      });
      is_selecting_ref.current = true;
    } else {
      on_selection([]);
    }
  };

  React.useEffect(() => {
    const onmouseup = (/** @type {MouseEvent} */ e) => {
      if (is_selecting_ref.current) {
        set_selection(null);
        is_selecting_ref.current = false;
      } else {
        // if you didn't click on a UI element...
        // TODO What is this for? Clicking run button should not deselect?
        if (
          !e.composedPath().some((e) => {
            // @ts-ignore
            const tag = e.tagName;
            return tag === "PLUTO-SHOULDER" || tag === "BUTTON";
          })
        ) {
          // ...clear the selection
          on_selection([]);
        }
      }
    };

    let update_selection = in_request_animation_frame(({ pageX, pageY }) => {
      if (!is_selecting_ref.current || selection == null) return;

      let new_selection_end = { x: pageX, y: pageY };

      /** @type {HTMLElement[]} */
      const cell_nodes = Array.from(
        element_ref.current.querySelectorAll("[data-cell-id]")
      );

      let A = {
        start_left: Math.min(selection.start.x, new_selection_end.x),
        start_top: Math.min(selection.start.y, new_selection_end.y),
        end_left: Math.max(selection.start.x, new_selection_end.x),
        end_top: Math.max(selection.start.y, new_selection_end.y),
      };
      let in_selection = cell_nodes.filter((cell) => {
        let cell_position = get_element_position_in_document(cell);
        let cell_size = cell.getBoundingClientRect();

        let B = {
          start_left: cell_position.left,
          start_top: cell_position.top,
          end_left: cell_position.left + cell_size.width,
          end_top: cell_position.top + cell_size.height,
        };
        return (
          A.start_left < B.end_left &&
          A.end_left > B.start_left &&
          A.start_top < B.end_top &&
          A.end_top > B.start_top
        );
      });

      on_selection(
        in_selection.map((x) => /** @type {string} */ (x.dataset.cellId))
      );
      set_selection({ start: selection.start, end: new_selection_end });
    });

    const onscroll = (e) => {
      if (is_selecting_ref.current && mouse_position_ref.current != null) {
        update_selection({
          pageX: mouse_position_ref.current.clientX,
          pageY:
            mouse_position_ref.current.clientY +
            document.documentElement.scrollTop,
        });
      }
    };

    const onmousemove = (e) => {
      mouse_position_ref.current = e;
      if (is_selecting_ref.current) {
        update_selection({ pageX: e.pageX, pageY: e.pageY });
        e.preventDefault();
      }
    };

    const onselectstart = (e) => {
      if (is_selecting_ref.current) {
        e.preventDefault();
      }
    };

    // // Ctrl+A to select all cells
    // const onkeydown = (e) => {
    //     if (e.key.toLowerCase() === "a" && has_ctrl_or_cmd_pressed(e)) {
    //         // if you are not writing text somewhere else
    //         if (document.activeElement === document.body && (window.getSelection()?.isCollapsed ?? true)) {
    //             on_selection(cell_order)
    //             e.preventDefault()
    //         }
    //     }
    // }

    document.addEventListener("mouseup", onmouseup);
    document.addEventListener("mousemove", onmousemove);
    document.addEventListener("selectstart", onselectstart);
    // document.addEventListener("keydown", onkeydown)
    document.addEventListener("scroll", onscroll, { passive: true });
    return () => {
      document.removeEventListener("mouseup", onmouseup);
      document.removeEventListener("mousemove", onmousemove);
      document.removeEventListener("selectstart", onselectstart);
      // document.removeEventListener("keydown", onkeydown)
      // @ts-ignore
      document.removeEventListener("scroll", onscroll, { passive: true });
    };
  }, [selection, on_selection]);

  // let translateY = `translateY(${Math.min(selection_start.y, selection_end.y)}px)`
  // let translateX = `translateX(${Math.min(selection_start.x, selection_end.x)}px)`
  // let scaleX = `scaleX(${Math.abs(selection_start.x - selection_end.x)})`
  // let scaleY = `scaleY(${Math.abs(selection_start.y - selection_end.y)})`

  return (
    <selection-area-wrapper
      style={{ display: "contents" }}
      ref={element_ref}
      // @ts-ignore
      onMouseDown={onmousedown}
    >
      <SimpleDialog open={selection != null}>
        <dral-prevent-hover
          style={{
            position: "fixed",
            inset: 0,
            overflow: "hidden",
          }}
        />

        {selection && (
          <dral-selection-area
            style={{
              position: "absolute",
              background: "rgba(40, 78, 189, 0.24)",
              outline: "rgba(255, 255, 255, 0.1) solid 1px",
              // zIndex: 1000000, // Yes, really
              // window.scrollY is not reactive ofcourse,
              // but on scroll we update the selection anyway
              top:
                Math.min(selection.start.y, selection.end.y) - window.scrollY,
              left: Math.min(selection.start.x, selection.end.x),
              width: Math.abs(selection.start.x - selection.end.x),
              height: Math.abs(selection.start.y - selection.end.y),
              // Transform could be faster
              // top: 0,
              // left: 0,
              // width: 1,
              // height: 1,
              // transformOrigin: "top left",
              // transform: `${translateX} ${translateY} ${scaleX} ${scaleY}`,
            }}
          />
        )}
      </SimpleDialog>

      {children}
    </selection-area-wrapper>
  );
};

let FullscreenDialog = styled("dialog")`
  max-height: unset;
  max-width: unset;
  height: 100%;
  width: 100%;
  background: none;
  border: none;

  &::backdrop {
    background: none;
  }
`;

let SimpleDialog = ({ open, children }) => {
  /** @type {import("react").MutableRefObject<HTMLDialogElement>} */
  let ref = React.useRef(/** @type {any} */ (null));

  React.useEffect(() => {
    if (open) {
      if (!ref.current.open) {
        ref.current.showModal();
      }
    } else {
      ref.current.close();
      console.log(
        `ref.current.getRootNode().activeElement:`,
        ref.current.getRootNode().activeElement
      );

      // Dialog.close() wants to move focus back to whatever had focus before,
      // which is fine-ish, but it also wants to set focusVisible to true,
      // which is not fine, so we blur and focus quickly to get rid of that.

      // @ts-ignore
      ref.current.getRootNode().activeElement?.blur?.();
      // @ts-ignore
      ref.current.getRootNode().activeElement?.focus({
        focusVisible: false,
      });
    }
  }, [open]);

  return <FullscreenDialog ref={ref}>{children}</FullscreenDialog>;
};
