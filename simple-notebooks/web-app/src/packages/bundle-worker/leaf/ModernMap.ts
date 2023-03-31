class ModernIterableIterator<T> implements Iterable<T> {
  private _iterator: Iterator<T>;
  constructor(iterator: Iterator<T>) {
    this._iterator = iterator;
  }
  static from<T>(generator: () => Generator<T>): ModernIterableIterator<T> {
    return new ModernIterableIterator(generator());
  }

  next() {
    return this._iterator.next();
  }

  [Symbol.iterator]() {
    return this;
  }

  map<V>(fn: (entry: T, map: this) => V) {
    let _this = this;
    return ModernIterableIterator.from(function* () {
      for (let entry of _this) {
        yield fn(entry, this);
      }
    });
  }

  filter(fn: (entry: T, map: this) => boolean): ModernIterableIterator<T> {
    let _this = this;
    return ModernIterableIterator.from(function* () {
      for (let entry of _this) {
        if (fn(entry, this)) {
          yield entry;
        }
      }
    });
  }

  some(fn: (entry: T, map: this) => boolean): boolean {
    for (let entry of this) {
      if (fn(entry, this)) {
        return true;
      }
    }
    return false;
  }

  toArray() {
    return [...this];
  }
}

export class ModernMap<K, V> extends Map<K, V> {
  values() {
    return new ModernIterableIterator(super.values());
  }
  keys() {
    return new ModernIterableIterator(super.keys());
  }
  entries() {
    return new ModernIterableIterator(super.entries());
  }

  // Polyfill for emplace proposal
  emplace(
    key: K,
    {
      insert,
      update = (x) => x,
    }: {
      insert?: (key: K, map: ModernMap<K, V>) => V;
      update?: (value: V, key: K, map: ModernMap<K, V>) => V;
    }
  ): V {
    if (this.has(key)) {
      let updated_value = update(this.get(key)!, key, this);
      this.set(key, updated_value);
      return updated_value;
    } else {
      if (insert == null) {
        throw new Error("Key not found and no insert function provided");
      }
      let fresh_value = insert(key, this);
      this.set(key, fresh_value);
      return fresh_value;
    }
  }
}