import { transform_code } from "../transform-javascript";
import { handleCalls } from "@dral/worker-typescript-magic/import-in-worker";

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
};

/**
 * @typedef Commands
 * @type {typeof commands}
 */

handleCalls(commands, true);
