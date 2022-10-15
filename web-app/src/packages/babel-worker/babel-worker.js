export let create_worker = () => {
  let worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });

  worker.onerror = (error) => {
    // prettier-ignore
    console.log(`ERROR WHILE SPAWNING WEBWORKER FOR TYPESCRIPT:`, error.message);
  };

  return worker;
};

let request_id_counter = 1;

class ErrorFromWorker extends Error {
  constructor(message, stack) {
    super(message);
    this.stack = stack;
  }
}

/**
 * @param {Worker} worker
 * @param {import("./worker").Message} message
 */
export let post_message = async (worker, message) => {
  let request_id = request_id_counter++;
  worker.postMessage({
    request_id: request_id,
    request: message,
  });

  return await new Promise((resolve, reject) => {
    let handle = (message) => {
      if (message.data.request_id === request_id) {
        console.log(`message:`, message.data);
        worker.removeEventListener("message", handle);
        // worker.removeEventListener("error", handle);

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
    worker.addEventListener("message", handle);
  });
};
