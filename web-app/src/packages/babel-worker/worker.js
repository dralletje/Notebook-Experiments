import { compact } from "lodash";
import * as x from "@babel/core";

import { transform_code } from "@dral/dralbook-transform-javascript";

let commands = {
  /** @param {{ code: string }} data */
  "transform-code": async ({ code }) => {
    try {
      return transform_code(code, { filename: "worker.js" });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(error.message);
      }
      throw error;
    }
  },
  /** @param {{ notebook: import("../../notebook-types").Notebook }} data */
  "notebook-to-file": async ({ notebook }) => {
    let parsed_cells = compact(
      notebook.cell_order.map((cell_id) => {
        let cell = notebook.cells[cell_id];
        if (cell.type === "text") return null;
        return transform_code(cell.code, { filename: "worker.js" });
      })
    );
  },
};

/**
 * @typedef _MessageObject
 * @type {{
 *  [P in keyof commands]?: { type: P, data: Parameters<commands[P]>[0] };
 * }}
 *
 * @typedef Message
 * @type {Exclude<_MessageObject[keyof _MessageObject], undefined>}
 */

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

/** @param {MessageEvent<{ request_id: unknown, job_id: string | null, request: Message }>} event */
self.onmessage = async (event) => {
  queue(event.data.job_id, async () => {
    console.group(event.data.request.type);
    try {
      console.log("Data from main thread:", event.data.request.data);
      let result = await commands[event.data.request.type](
        // @ts-ignore
        event.data.request.data
      );
      console.log("result:", result);
      postMessage({
        request_id: event.data.request_id,
        type: "success",
        result,
      });
    } catch (error) {
      console.log(`error:`, error);
      postMessage({
        request_id: event.data.request_id,
        type: "error",
        error: { message: error.message, stack: error.stack },
      });
    } finally {
      console.groupEnd();
    }
  });
};
