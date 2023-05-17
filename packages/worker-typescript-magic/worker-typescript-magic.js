class ErrorFromWorker extends Error {
  constructor(message, stack) {
    super(message);
    this.stack = stack;
  }
}

/**
 * @typedef GenericCommands
 * @type {{ [key: string]: (x: any) => any }}
 */

/**
 * A wrapper around a Worker that makes it types safe (if the worker side complies to my demands, that is).
 * Used to extend Worker, but vite didn't like that... D:
 *
 * @template {GenericCommands} T
 */
export class MagicWorker {
  /** @private */
  request_id_counter = 1;

  /** @param {Worker} worker */
  constructor(worker) {
    console.log(`worker:`, worker);
    this.worker = worker;
  }

  terminate() {
    console.log("TERMINATE");
    this.worker.terminate();
  }

  /**
   * @template {keyof T} P
   * @param {P} method
   * @param {Parameters<T[P]>[0]} data
   * @returns {Promise<ReturnType<T[P]>>}
   */
  async request(method, data) {
    let request_id = this.request_id_counter++;

    console.log("#1");
    // this.worker.postMessage({
    //   request_id: request_id,
    //   request: { type: method, data: data },
    // });
    console.log("#2");

    return await new Promise((resolve, reject) => {
      let handle_message = (message) => {
        console.log("#4.1");
        if (message.data.request_id === request_id) {
          cleanup();
          console.log("#5", message);
          if (message.data.type === "success") {
            resolve(message.data.result);
          } else if (message.data.type === "error") {
            reject(
              new ErrorFromWorker(
                message.data.error.message,
                message.data.error.stack
              )
            );
          } else {
            reject(new Error("Unknown message type"));
          }
        }
      };

      console.log("#3");
      let handle_error = (error) => {
        cleanup();
        reject(error);
      };
      let cleanup = () => {
        this.worker.removeEventListener("message", handle_message);
        this.worker.removeEventListener("error", handle_error);
      };
      console.log("#4");
      this.worker.addEventListener("message", handle_message);
      this.worker.addEventListener("error", handle_error);
    });
  }
}
