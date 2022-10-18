/** @type {Array<{ id: string | null, job: () => Promise<unknown> }>} */
let _queue = [];
let is_running = false;
let run_next = () => {
  if (!is_running) {
    let job = _queue.shift();
    if (job) {
      is_running = true;
      job.job().then(() => {
        is_running = false;
        run_next();
      });
    }
  }
};
/**
 * @param {string | null} id
 * @param {() => Promise<unknown>} job
 */
let queue = async (id, job) => {
  // Remove job with the same id
  if (id != null) {
    _queue = _queue.filter((x) => x.id !== id);
  }

  _queue.push({ id, job });
  run_next();
};

/**
 * @typedef Message
 * @type {{
 *  request_id: unknown,
 *  job_id: string | null,
 *  request: {
 *    type: string,
 *    data: any,
 *  },
 * }}
 */

/** @param {import("./worker-typescript-magic").GenericCommands} commands */
export let handleCalls = (commands, debug = false) => {
  /** @param {MessageEvent<Message>} event */
  self.onmessage = async (event) => {
    queue(event.data.job_id, async () => {
      if (debug) console.group(event.data.request.type);
      try {
        if (debug)
          console.log("Data from main thread:", event.data.request.data);
        let result = await commands[event.data.request.type](
          event.data.request.data
        );
        if (debug) console.log("result:", result);
        postMessage({
          request_id: event.data.request_id,
          type: "success",
          result,
        });
      } catch (error) {
        if (debug) console.log(`error:`, error);
        postMessage({
          request_id: event.data.request_id,
          type: "error",
          error: { message: error.message, stack: error.stack },
        });
      } finally {
        if (debug) console.groupEnd();
      }
    });
  };
};
