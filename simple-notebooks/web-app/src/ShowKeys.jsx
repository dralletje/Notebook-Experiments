import { sortBy } from "lodash";
import React from "react";
import { Flipper, Flipped } from "react-flip-toolkit";

export let ShowKeysPressed = () => {
  let [keys_pressed, set_keys_pressed] = React.useState(new Set());

  let key_remove_timeouts = React.useRef(new Map());

  React.useEffect(() => {
    let fn = (event) => {
      set_keys_pressed((x) => {
        let new_x = new Set(x);
        new_x.add(event.key);
        return new_x;
      });
      if (event.metaKey && /^[a-z]$/.test(event.key)) {
        if (key_remove_timeouts.current.has(event.key)) {
          clearTimeout(key_remove_timeouts.current.get(event.key));
        }
        key_remove_timeouts.current.set(
          event.key,
          setTimeout(() => {
            set_keys_pressed((x) => {
              let new_x = new Set(x);
              new_x.delete(event.key);
              return new_x;
            });
          }, 500)
        );
      }
    };
    window.addEventListener("keydown", fn, { capture: true });
    return () => {
      window.removeEventListener("keydown", fn, { capture: true });
    };
  }, []);

  React.useEffect(() => {
    let fn = (event) => {
      set_keys_pressed((x) => {
        let new_x = new Set(x);
        new_x.delete(event.key);
        if (event.key === "Meta") {
          new_x.clear();
        }
        return new_x;
      });
    };
    window.addEventListener("keyup", fn, { capture: true });
    return () => {
      window.removeEventListener("keyup", fn, { capture: true });
    };
  }, []);

  return (
    <Flipper
      flipKey={Array.from(keys_pressed.values()).join(",")}
      spring={"stiff"}
    >
      <div
        style={{
          position: "fixed",
          right: 20,
          bottom: 40,
          whiteSpace: "pre",
          fontSize: 50,

          display: "flex",
          flexDirection: "row",
          gap: 8,
        }}
      >
        {sortBy(Array.from(keys_pressed.values()), (x) =>
          x === "Meta" ? 1 : x === "Shift" ? 2 : 3
        ).map((key, index, arr) => (
          <Flipped key={key} flipId={key}>
            <kbd style={{ display: "block" }}>
              {key === "Meta"
                ? "⌘"
                : key === "Shift"
                ? "Shift"
                : key.length === 1
                ? key.toUpperCase()
                : key}
            </kbd>
          </Flipped>
        ))}
      </div>
    </Flipper>
  );
};
