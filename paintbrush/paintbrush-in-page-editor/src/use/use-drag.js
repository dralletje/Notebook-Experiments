import React from "react";

export let use_drag = (
  /** @type {React.MutableRefObject<HTMLElement>} */ container_ref,
  /** @type {(delta: { delta_x: number, delta_y: number }) => void} */ on_drag_end
) => {
  let unsubscribe_drag_ref = React.useRef(() => {});

  /** @type {import("react").MouseEventHandler<HTMLDivElement>} */
  let onMouseDown = (
    /** @type {import("react").MouseEvent<HTMLDivElement, MouseEvent>} */ event
  ) => {
    if (event.defaultPrevented) return;

    let x = event.clientX;
    let y = event.clientY;

    unsubscribe_drag_ref.current();
    let mousemove_handler = (/** @type {MouseEvent} */ event) => {
      let delta_x = event.clientX - x;
      let delta_y = event.clientY - y;

      container_ref.current.style.transform = `translateX(${delta_x}px) translateY(${delta_y}px)`;
    };
    document.addEventListener("mousemove", mousemove_handler);

    let mouseup_handler = (/** @type {MouseEvent} */ event) => {
      unsubscribe_drag_ref.current();
      let delta_x = event.clientX - x;
      let delta_y = event.clientY - y;

      on_drag_end({ delta_x, delta_y });

      // set_position(({ right, bottom }) => {
      //   return {
      //     right: right - delta_x,
      //     bottom: bottom - delta_y,
      //   };
      // });
      container_ref.current.style.transform = "";
    };
    document.addEventListener("mouseup", mouseup_handler);

    unsubscribe_drag_ref.current = () => {
      document.removeEventListener("mousemove", mousemove_handler);
      document.removeEventListener("mouseup", mouseup_handler);
      unsubscribe_drag_ref.current = () => {};
    };
  };

  return { onMouseDown };
};
