import { range } from "lodash-es";
import React from "react";

// Time to actually make this into it's own package?
// Pffff

// Don't think I can make this more complex?
// Wait till I add typescript....

/**
 * @template T
 */
export class ScopedStorage {
  /** @type {string} */
  key;

  constructor(/** @type {string} */ key) {
    this.key = key;
  }

  /** @returns {T | null} */
  get() {
    try {
      let string_value = localStorage.getItem(this.key);
      if (string_value == null) {
        return null;
      } else {
        return JSON.parse(string_value);
      }
    } catch (error) {
      return null;
    }
  }

  /** @param {T} value */
  set(value) {
    if (value == null) {
      this.remove();
    } else {
      localStorage.setItem(this.key, JSON.stringify(value));
    }
  }

  remove() {
    localStorage.removeItem(this.key);
  }

  child(/** @type {string} */ key) {
    return new ScopedStorage(`${this.key}.${key}`);
  }

  children() {
    return range(0, localStorage.length)
      .map((index) => /** @type {String} */ (localStorage.key(index)))
      .filter((key) => key.startsWith(this.key))
      .map((key) => new ScopedStorage(key));
  }
}

/**
 * @template T
 * @param {ScopedStorage} storage
 * @param {T} [default_value]
 * @returns {[T, (value: T) => void]}
 */
export let useScopedStorage = (storage, default_value) => {
  // TODO I totally assume `storage` doesn't change and I'm okay with that

  let initial_storage = React.useMemo(() => {
    return storage.get();
  }, []);
  let [value, set_value] = React.useState(initial_storage ?? default_value);

  let set_value_and_store = React.useCallback(
    (/** @type {T} */ value) => {
      set_value(value);
      storage.set(value);
    },
    [set_value]
  );

  return [value, set_value_and_store];
};
