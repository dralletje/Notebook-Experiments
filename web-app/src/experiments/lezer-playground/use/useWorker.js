import React from "react";

/**
 * @typedef PoorMansWorker
 * @type {{ terminate: () => void }}
 */

/**
 * @template {PoorMansWorker} T
 * @param {() => T} create_worker
 * @param {any[]} deps
 * @returns {T | null}
 */
export let useWorker = (create_worker, deps) => {
  let [worker, set_worker] = React.useState(
    /** @type {T} */ (/** @type {any} */ (null))
  );
  React.useEffect(() => {
    let worker = create_worker();

    set_worker(worker);

    return () => {
      worker.terminate();
    };
  }, deps);
  return worker;
};

/**
 * @template {PoorMansWorker} T
 * @param {() => T} create_worker
 * @returns {(signal: AbortSignal) => T}
 */
export let useWorkerPool = (create_worker) => {
  let workers_ref = React.useRef(new Set());

  React.useEffect(() => {
    return () => {
      for (let worker of workers_ref.current) {
        worker.terminate();
      }
    };
  }, []);

  let get_worker = React.useCallback(
    (/** @type {AbortSignal} */ abort_signal) => {
      let worker = create_worker();
      workers_ref.current.add(worker);

      abort_signal.addEventListener("abort", () => {
        worker.terminate();
        workers_ref.current.delete(worker);
      });

      return worker;
    },
    []
  );

  return get_worker;
};
