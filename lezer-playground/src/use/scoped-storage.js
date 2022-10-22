import React from "react";

// Time to actually make this into it's own package?
// Pffff

// Don't think I can make this more complex?
// Wait till I add typescript....

export class ScopedStorage {
  constructor(/** @type {string} */ key) {
    this.key = key;
  }
  get() {
    try {
      let string_value = localStorage.getItem(this.key);
      if (string_value == null) {
        return string_value;
      } else {
        return JSON.parse(string_value);
      }
    } catch (error) {
      return null;
    }
  }

  set(value) {
    localStorage.setItem(this.key, JSON.stringify(value));
  }

  child(/** @type {string} */ key) {
    return new ScopedStorage(`${this.key}.${key}`);
  }
}

export let useScopedStorage = (
  /** @type {ScopedStorage} */ storage,
  default_value
) => {
  // TODO I totally assume `storage` doesn't change and I'm okay with that

  let initial_storage = React.useMemo(() => {
    return storage.get();
  }, []);
  let [value, set_value] = React.useState(initial_storage ?? default_value);

  let set_value_and_store = React.useCallback(
    (value) => {
      set_value(value);
      storage.set(value);
    },
    [set_value]
  );

  return [value, set_value_and_store];
};
