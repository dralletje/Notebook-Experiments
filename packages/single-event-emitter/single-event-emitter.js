import { EventEmitter } from "events";

/**
 * @template T
 */
export class SingleEventEmitter {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(Infinity);
  }
  /**
   * @param {(value: T) => void} listener
   * @returns {() => void}
   */
  on(listener) {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.removeListener("event", listener);
    };
  }

  /**
   * @param {(value: T) => void} listener
   * @returns {void}
   */
  off(listener) {
    this.emitter.removeListener("event", listener);
  }

  /**
   * @param {T} value
   * @returns {void}
   */
  emit(value) {
    this.emitter.emit("event", value);
  }
}
