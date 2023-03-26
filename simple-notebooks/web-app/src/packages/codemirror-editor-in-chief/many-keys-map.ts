import { zip } from "lodash";

const baseMap = Symbol("baseMap");

class Value {
  constructor(value) {
    this.value = value;
  }
}

function getLastMap({ [baseMap]: map }, keys, create = undefined) {
  if (!Array.isArray(keys)) {
    throw new TypeError("The keys parameter must be an array");
  }

  for (const [key, next_key] of zip(keys, keys.slice(1))) {
    if (!map.has(key)) {
      if (create) {
        if (next_key instanceof Object) {
          map.set(key, new WeakMap());
        } else {
          map.set(key, new Map());
        }
      } else {
        return undefined;
      }
    }

    map = map.get(key);
  }

  return map;
}

export default class ManyKeysWeakMap<K extends Array<any>, V>
  implements WeakMap<K, V>
{
  [baseMap] = new WeakMap();

  constructor() {
    const [pairs] = arguments; // WeakMap compat
    if (pairs === null || pairs === undefined) {
      return;
    }

    if (typeof pairs[Symbol.iterator] !== "function") {
      throw new TypeError(
        typeof pairs +
          " is not iterable (cannot read property Symbol(Symbol.iterator))"
      );
    }

    for (const [keys, value] of pairs) {
      this.set(keys, value);
    }
  }

  set(keys, value) {
    const lastMap = getLastMap(this, keys, true);
    lastMap.set(Value, value);
    return this;
  }

  get(keys) {
    const lastMap = getLastMap(this, keys);
    return lastMap ? lastMap.get(Value) : undefined;
  }

  has(keys) {
    const lastMap = getLastMap(this, keys);
    return Boolean(lastMap) && lastMap.has(Value);
  }

  delete(keys) {
    const lastMap = getLastMap(this, keys);
    return Boolean(lastMap) && lastMap.delete(Value);
  }

  get [Symbol.toStringTag]() {
    return "ManyKeysWeakMap";
  }
}
