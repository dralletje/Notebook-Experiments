import { compact } from "lodash";
import * as x from "@babel/core";

import { transform_code } from "@dral/dralbook-transform-javascript";
import { handleCalls } from "../worker-typescript-magic/worker";

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
 * @typedef Commands
 * @type {typeof commands}
 */

handleCalls(commands);
