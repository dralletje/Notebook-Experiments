import React from "react";

// I'm making this waaaayyyy to complex (but I love it)
// (should really have made this in typescript...)

/**
 * @template T
 * @typedef ExecutionResult
 * @type {Success<T> | Failure<T> | Loading<T>}
 */

/**
 * @template T
 */
export class Success {
  constructor(/** @type {T} */ value) {
    this.value = value;
  }
  /**
   * @template R
   * @param {(value: T) => R} f
   * @returns {ExecutionResult<R>}
   */
  map(f) {
    try {
      return new Success(f(this.value));
    } catch (error) {
      if (error instanceof Failure) {
        return new Failure();
      } else if (error instanceof Loading) {
        return new Loading();
      } else {
        return new Failure(error);
      }
    }
  }
  /**
   * @returns {T}
   */
  get() {
    return this.value;
  }

  /**
   * @template T
   * @param {T} value
   */
  or(value) {
    return this.value;
  }
  /** @template T */
  static of(/** @type {T} */ value) {
    return new Success(value);
  }
}

/**
 * @template T
 */
export class Failure {
  constructor(value) {
    this.value = value;
  }
  /**
   * @template R
   * @param {R} value
   */
  or(value) {
    return value;
  }
  /**
   * @returns {never}
   */
  get() {
    throw this.value;
  }
  /**
   * @template R
   * @param {(value: T) => R} f
   * @returns {Failure<R>}
   */
  map(f) {
    return new Failure(this.value);
  }
  static of(value) {
    return new Failure(value);
  }
}

/**
 * @template T
 */
export class Loading {
  /**
   * @param {Promise<T>} [promise]
   */
  constructor(promise) {
    this.promise = promise;
  }
  /**
   * @template R
   * @param {(value: T) => R} f
   * @returns {Loading<R>}
   */
  map(f) {
    return new Loading(this.promise?.then(f));
  }
  /**
   * @template R
   * @param {R} value
   */
  or(value) {
    return value;
  }
  /**
   * @returns {never}
   */
  get() {
    throw this;
  }
  static of() {
    return new Loading();
  }
}

/**
 * @template T
 * @param {(abort_signal: AbortSignal) => Promise<T>} fn
 * @param {any[]} deps
 * @returns {ExecutionResult<T>}
 */
export let usePromise = (fn, deps) => {
  let [value, set_value] = React.useState(
    /** @type {ExecutionResult<T>} */ (Loading.of())
  );

  React.useEffect(() => {
    let cancelled = false;
    let abort_controller = new AbortController();

    set_value(Loading.of());
    Promise.resolve().then(async () => {
      try {
        let value = await fn(abort_controller.signal);
        if (cancelled) return;

        if (value instanceof Loading) {
          // Already loading yeh
        }
        set_value(value instanceof Failure ? value : Success.of(value));
      } catch (error) {
        if (cancelled) return;

        if (error instanceof Failure) {
          set_value(error);
        } else if (error instanceof Loading) {
          // No set needed, because we're already loading
        } else {
          set_value(Failure.of(error));
        }
      } finally {
        abort_controller.abort();
      }
    });

    return () => {
      cancelled = true;
      abort_controller.abort();
    };
  }, deps);

  return value;
};

/**
 * @template T
 * @param {ExecutionResult<T>} result
 */
export let useMemoizeSuccess = (result) => {
  let value_ref = React.useRef(result);

  if (result instanceof Success || result instanceof Failure) {
    value_ref.current = result;
  }

  return value_ref.current;
};
