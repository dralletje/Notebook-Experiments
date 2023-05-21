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
        yield fn(entry, _this);
      }
    });
  }

  flatMap<V>(fn: (entry: T, map: this) => Iterable<V>) {
    let _this = this;
    return ModernIterableIterator.from(function* () {
      for (let entry of _this) {
        yield* fn(entry, _this);
      }
    });
  }

  filter(fn: (entry: T, map: this) => boolean): ModernIterableIterator<T> {
    let _this = this;
    return ModernIterableIterator.from(function* () {
      for (let entry of _this) {
        if (fn(entry, _this)) {
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
      this.entries().filter(([key, value]) => fn(value as any, key, this))
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
      // Very weird how I need `V_star extends V` here for arguments.
      // It only happens when the function is inside an object like this
      // (`emplace(insert: (key: K, map: ModernMap<K, V>) => V) { ... }` wouldn't make this error)
      // To check if the error exists, you can do
      // `let x = ModernMap<string, {}> = null as any as ModernMap<string, { x: 10 }>`
      // This line should not produce a type error, but without the `V_star extends V` it does.
      insert?: <K_star extends K, V_star extends V>(
        key: K_star,
        map: ModernMap<K_star, V_star>
      ) => V;
      update?: <K_star extends K, V_star extends V>(
        value: V_star,
        key: K_star,
        map: ModernMap<K_star, V_star>
      ) => V;
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

export class ModernWeakMap<K extends Object, V> extends WeakMap<K, V> {
  // Polyfill for emplace proposal
  // https://github.com/tc39/proposal-upsert
  emplace(
    key: K,
    {
      insert,
      update = (x) => x,
    }: {
      // Very weird how I need `V_star extends V` here for arguments.
      // It only happens when the function is inside an object like this
      // (`emplace(insert: (key: K, map: ModernMap<K, V>) => V) { ... }` wouldn't make this error)
      // To check if the error exists, you can do
      // `let x = ModernMap<string, {}> = null as any as ModernMap<string, { x: 10 }>`
      // This line should not produce a type error, but without the `V_star extends V` it does.
      insert?: <K_star extends K, V_star extends V>(
        key: K_star,
        map: ModernWeakMap<K_star, V_star>
      ) => V;
      update?: <K_star extends K, V_star extends V>(
        value: V_star,
        key: K_star,
        map: ModernWeakMap<K_star, V_star>
      ) => V;
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
