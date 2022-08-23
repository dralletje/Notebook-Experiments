import React from "react";
import { Inspector as ObservableInspector } from "@observablehq/inspector";

/**
 * @param {object} props
 * @param {{ type: 'return', value: any } | { type: 'throw', error: any } | { type: 'pending' }} props.value
 */
export let Inspector = ({ value }) => {
  let dom_ref = React.useRef(/** @type {any} */ (null));
  let inspector_ref = React.useRef(/** @type {any} */ (null));

  React.useEffect(() => {
    if (inspector_ref.current == null) {
      inspector_ref.current = new ObservableInspector(dom_ref.current);
    }

    if (value.type === "return") {
      inspector_ref.current.fulfilled(value.value);
    } else if (value.type === "throw") {
      inspector_ref.current.rejected(value.value);
    } else if (value.type === "pending") {
      inspector_ref.current.pending();
    }
  }, [value]);

  return React.createElement("div", {
    ref: dom_ref,
    style: { display: "contents" },
  });
};
