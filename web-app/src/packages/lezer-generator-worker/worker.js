import { handleCalls } from "../worker-typescript-magic/worker";

import { buildParser, buildParserFile } from "@dral/lezer-generator";

let commands = {
  /** @param {{ code: string }} data */
  "build-parser": async ({ code }) => {
    return buildParserFile(code);

    // return buildParser(code);
  },
};

/**
 * @typedef Commands
 * @type {typeof commands}
 */

handleCalls(commands);
