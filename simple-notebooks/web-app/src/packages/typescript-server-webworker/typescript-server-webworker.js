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
        worker.removeEventListener("message", handle);
        // worker.removeEventListener("error", handle);
        resolve(message.data.result);
      }
    };
    worker.addEventListener("message", handle);
  });
};
