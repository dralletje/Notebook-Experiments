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
    { insert, update }: { insert: () => V; update: (value: V) => V }
  ) {
    if (this.has(key)) {
      this.set(key, update(this.get(key)!));
    } else {
      this.set(key, insert());
    }
  }
}
