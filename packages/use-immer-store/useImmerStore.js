import React from "react";
import produce, {
  setAutoFreeze,
  enableMapSet,
  enablePatches,
  current,
} from "immer";
// For some reason `mem` doesn't play nicely with the workspaces stuff,
// and this fixes it...........
import mem from "mem";
import DeepWeakMap from "deep-weak-map";

// AutoFreeze screws with proxies
setAutoFreeze(false);
enableMapSet();
// enablePatches();

let is_object = (value) => value != null && typeof value === "object";
class PreconditionFailed extends Error {}
let precondition = (condition, message = "Precondition failed") => {
  if (!condition) {
    throw new PreconditionFailed(message);
  }
};

let mutate_symbol = Symbol("Mutate this variable");
/**
 * Main character in this story.
 * Use this to "magically" mutate a value that has been "immer-store"-ed.
 * @function
 * @template T
 * @param {T} store
 * @param {(value: T) => void} mutate_fn
 * @returns {void}
 */
export let mutate = (store, mutate_fn) => {
  precondition(is_object(store), "Can't mutate primitive value");
  precondition(store[mutate_symbol], "Non-store object passed to mutate()");
  store[mutate_symbol](mutate_fn);
};

/**
 * Small functions that I found very useful because I often apply immer-style
 * mutations inside a already immer-style mutate() call.
 * This helps take care of mutation but also return-ed totally new values.
 * @function
 * @template T
 * @param {T} value
 * @param {(value: T) => undefined | T} mutate_fn
 * @returns {T}
 */
export let mutate_immer_like = (value, mutate_fn) => {
  let possibly_new_value = mutate_fn(value);
  return possibly_new_value === undefined ? value : possibly_new_value;
};

let readonly_symbol = Symbol("Readonly version this variable");
/**
 * So you can pass a un-mutate()-able version of your data to a component
 * @function
 * @template T
 * @param {T} store
 * @returns {T}
 */
export let readonly = (store) => {
  return store[readonly_symbol];
};

let mutate_identity_symbol = Symbol("Get function that mutate");
/**
 * Get the mutator function for a given store.
 * Mutator functions are more stable than the store itself.
 * Mainly useful for dependencies in React hooks.
 * @function
 * @template T
 * @param {T} store
 * @returns {(mutate_fn: (value: T) => void) => void}
 */
export let mutator = (store) => {
  return store[mutate_identity_symbol];
};

export let proxies_made = 0;
/**
 * @template {{ [key: string]: any }} T
 * @param {[T, (update_fn: (value: T) => T) => void]} useStateResult
 */
export let make_store_proxy = ([state, update_state]) => {
  proxies_made++;
  return new Proxy(state, {
    get(target, property, receiver) {
      if (property === mutate_symbol) {
        // Secret property to access the mutator function
        return (mutate_fn) => {
          update_state((value) => mutate_fn(value));
        };
      } else if (property === readonly_symbol) {
        // Secret property to get the "real" value
        return target;
      } else if (property === mutate_identity_symbol) {
        // Secret property to get the mutator function (more stable than the store itself)
        return update_state;
      } else if (!target.hasOwnProperty(property)) {
        // Returns properties from the prototype
        // This is required for array methods like .map()
        return Reflect.get(target, property, receiver);
        // @ts-ignore - can't have symbols as keys apparently
      } else if (is_object(target[property])) {
        // If the value to returns is an object, we wrap it in a proxy
        // to take care of mutation.
        // First we get the
        let mutate_property = get_mutator_for_property(update_state, property);
        let value = Reflect.get(target, property, target);
        let made = make_store_proxy_cached([value, mutate_property]);
        return made;
        // @ts-ignore - can't have symbols as keys apparently
      } else if (typeof target[property] === "function") {
        // I think this is fine, but I'm keeping this error so when I use it I'll be more aware
        throw new Error("We don't do that here");
      } else {
        // If the value to returns is a primitive, we just return it
        return Reflect.get(target, property, target);
      }
    },
    set() {
      // prettier-ignore
      throw new Error(`Don't mutate a store directly, use update(store, store => ...)`)
    },
  });
};

let mutate_function_cache = mem((x) => new Map(), { cache: new WeakMap() });
/**
 * Caches a sub_updater for every (updater => sub_property) pair.
 * Kind of works like a nice unidirectional graph, where you can trace to
 * any sub-sub-sub mutator by calling this repeatedly.
 * @function
 * @template {Function} T
 * @template {string | symbol} S
 * @param {T} update_state
 * @param {S} property
 * @returns {(mutate_fn: (value: Parameters<T>[0][S]) => void) => void}
 */
let get_mutator_for_property = (update_state, property) => {
  /** @type {Map<string | symbol, (value: any) => void>} */
  let mutate_map = mutate_function_cache(update_state);
  mutate_map.set(
    property,
    mutate_map.get(property) != null
      ? mutate_map.get(property)
      : (mutate_fn) => {
          update_state((value) => {
            value[property] = mutate_immer_like(value[property], mutate_fn);
          });
        }
  );
  return mutate_map.get(property);
};

mem((x) => x, { cacheKey: (x) => x });

let make_store_proxy_cached = mem(make_store_proxy, {
  cache: new DeepWeakMap(),
  // Reverse the order of how we query the weakmap, because update_state is more stable.
  cacheKey: ([[state, update_state]]) => [update_state, state],
});

// type OneArgumentOverload<Func, Arg> = Func extends ((value: Arg) => infer T) ? T : never
// type SetStateResult<T> = OneArgumentOverload<typeof React.useState, T>

// /**
//  * For some reason this typedef just won't work, so I had to copy it in useImmerStore
//  * ...... So turns out JSDOC doesn't support generic types........
//  * @typedef SetStateResult
//  * @template T
//  * @type {[T, (update_fn: (value: T) => T) => void]}
//  */

/**
 * @function
 * @template T
 * @param {[T, (update_fn: (value: T) => T) => void]} useStateResult
 * @returns {T}
 */
export let useMutateable = (state, update_state) => {
  return make_store_proxy_cached([state, update_state]);
};

/**
 * @function
 * @template T
 * @param {[T, (update_fn: (value: T) => T) => void]} useStateResult
 * @returns {T}
 */
export let useImmerStore = ([state, set_state]) => {
  // Is this useMemo necessary? Feel like it doesn't.
  // Without this I can't sell this as a hook!
  let update_state = React.useMemo(() => {
    return (update_fn) => set_state(produce(update_fn));
  }, [set_state]);

  return make_store_proxy_cached([state, update_state]);
};
