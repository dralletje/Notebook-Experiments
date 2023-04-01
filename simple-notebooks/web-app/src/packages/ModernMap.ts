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
  every(fn: (entry: T, map: this) => boolean): boolean {
    return !this.some((x) => !fn(x, this));
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

  // https://github.com/tc39/proposal-collection-methods
  mapValues<T>(fn: (value: V, key: K, map: this) => T) {
    return new ModernMap(
      this.entries().map(([key, value]) => [key, fn(value, key, this)])
    );
  }
  filter<T>(fn: (value: V, key: K, map: this) => boolean) {
    return new ModernMap(
      this.entries().filter(([key, value]) => fn(value, key, this))
    );
  }
  every<T>(fn: (value: V, key: K, map: this) => boolean) {
    return this.entries().every(([key, value]) => fn(value, key, this));
  }
  some<T>(fn: (value: V, key: K, map: this) => boolean) {
    return this.entries().some(([key, value]) => fn(value, key, this));
  }

  // Polyfill for emplace proposal
  // https://github.com/tc39/proposal-upsert
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
