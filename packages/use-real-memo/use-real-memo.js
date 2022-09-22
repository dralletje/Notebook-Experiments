import React from "react";

/**
 * @template T
 * @param {() => T} fn
 * @param {Array<any>} deps
 */
export let useRealMemo = (fn, deps) => {
  let was_created_ref = React.useRef(false);
  /** @type {import("react").MutableRefObject<T>} */
  let value_ref = React.useRef(/** @type {any} */ (null));
  /** @type {import("react").MutableRefObject<Array<any>>} */
  let previous_deps_ref = React.useRef([]);

  if (was_created_ref.current === false) {
    value_ref.current = fn();
    was_created_ref.current = true;
  } else {
    if (previous_deps_ref.current.length !== deps.length) {
      throw new Error("useRealMemo: deps length changed");
    }

    // NOTE I DID NOT CREATED THIS FOR LOOP!!!
    // .... Copilot did, so I'll leave it here...
    // .... but normally, NO FOR LOOPS!
    for (let i = 0; i < deps.length; i++) {
      if (deps[i] !== previous_deps_ref.current[i]) {
        value_ref.current = fn();
        break;
      }
    }
  }
  previous_deps_ref.current = deps;

  return value_ref.current;
};

export let useDidJustHotReload = () => {
  let did_mount = React.useRef(false);
  let did_re_memo = React.useMemo(() => ({ current: true }), []);

  if (did_mount.current === false) {
    did_mount.current = true;
    return false;
  }

  if (did_re_memo.current === true) {
    did_re_memo.current = false;
    return true;
  }

  return false;
};
