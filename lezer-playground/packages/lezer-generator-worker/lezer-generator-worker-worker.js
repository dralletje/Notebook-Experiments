await import("./setup-env.js");
let { handleCalls } = await import(
  "@dral/worker-typescript-magic/import-in-worker.js"
);

import { buildParserFile } from "@lezer/generator";

let commands = {
  /**
   * Would have loved to use `buildParser` directly, but the parser doesn't serialize.
   * So now you get the generated files instead, and you have to execute those on the main thread.
   *
   * @param {{ code: string }} data
   */
  "build-parser": async ({ code }) => {
    try {
      return buildParserFile(code);
    } catch (error) {
      console.error("ASDASD", error);
      throw error;
    }
    // return buildParser(code);
  },
};
/**
 * @typedef Commands
 * @type {typeof commands}
 */
handleCalls(commands);
