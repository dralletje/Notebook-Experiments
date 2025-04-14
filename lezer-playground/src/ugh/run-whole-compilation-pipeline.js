import React from "react";
import { lezerLanguage } from "@codemirror/lang-lezer";
import { iterate_over_cursor } from "dral-lezer-helpers";
import { LRParser } from "@lezer/lr";

import { useWorker, useWorkerPool } from "../use/useWorker.js";
import { LezerGeneratorWorker } from "@dral/lezer-generator-worker";
import { TransformJavascriptWorker } from "../should-be-shared/transform-javascript/worker/transform-javascript-worker.js";
import {
  Failure,
  Loading,
  Success,
  usePromise,
} from "../use/OperationMonadBullshit.js";

/**
 * @template T
 * @typedef ExecutionResult
 * @type {import("../use/OperationMonadBullshit.js").ExecutionResult<T>}
 */

class TermsFileNotReadyError extends Error {
  constructor() {
    super("Terms file not ready");
  }
}

/**
 * @param {string[]} imported
 * @param {any} mod
 */
let verify_imported = (imported, mod) => {
  let invalid_imports = imported.filter((i) => !(i in mod));
  if (invalid_imports.length > 0) {
    throw new TypeError(`Module does not export ${invalid_imports.join(", ")}`);
  }
  return mod;
};

let requestIdleCallback = (fn) => {
  if ("requestIdleCallback" in window) {
    return window.requestIdleCallback(fn);
  } else {
    // @ts-expect-error - TS doesn't know requestIdleCallback isn't always present
    return window.setTimeout(fn, 0);
  }
};
let cancelIdleCallback = (id) => {
  if ("cancelIdleCallback" in window) {
    return window.cancelIdleCallback(id);
  } else {
    // @ts-expect-error - TS doesn't know requestIdleCallback isn't always present
    return window.clearTimeout(id);
  }
};

/**
 * @param {AbortSignal} signal
 */
let requestIdlePromise = async (signal) => {
  await new Promise((resolve) => requestIdleCallback(resolve));
  if (signal.aborted) {
    await new Promise(() => {});
  }
};

/**
 * TODO Bind run_cell_code not to code,
 * .... but a mystical "parsed cell" type that comes
 * .... from transform-javascript?
 *
 * @param {string} code
 * @param {{ [argument: string]: any }} globals
 * @return {Promise<{
 *  export: { [key: string]: any },
 * }>}
 */
let run_cell_code = async (code, globals) => {
  let f = new Function(...Object.keys(globals), code);
  return await f(...Object.values(globals));
};

/**
 * @param {{
 *  do_run: boolean;
 *  parser_code: string;
 * }} props
 */
export let useLezerCompiled = ({ do_run, parser_code }) => {
  let get_lezer_worker = useWorkerPool(() => new LezerGeneratorWorker());

  let generated_parser = usePromise(
    async (signal) => {
      if (!do_run) {
        throw new Error("Not running");
      }

      await requestIdlePromise(signal);
      await requestIdlePromise(signal);
      await requestIdlePromise(signal);
      await requestIdlePromise(signal);

      // Find empty Body's in the lezer parser, which will definitely lead to an infinite loop
      let lezer_parser = lezerLanguage.parser;
      let partial_parse = lezer_parser.startParse(parser_code);

      let DELAY_EVERY_X_MILLISECONDS = 5;
      let last_parse_start = performance.now();
      let request_idle_count = 0;

      /** @type {import("@lezer/common").Tree} */
      let tree = /** @type {any} */ (null);
      while (true) {
        let tree_or_not = partial_parse.advance();
        if (tree_or_not != null) {
          tree = tree_or_not;
          break;
        }

        if (performance.now() - last_parse_start > DELAY_EVERY_X_MILLISECONDS) {
          await requestIdlePromise(signal);
          request_idle_count += 1;
          last_parse_start = performance.now();
        }
      }

      iterate_over_cursor({
        cursor: tree.cursor(),
        enter: (cursor) => {
          if (cursor.name === "Body") {
            if (cursor.node.parent?.name === "SkipScope") {
              return;
            }

            let has_a_child = false;
            if (cursor.firstChild()) {
              try {
                do {
                  if (/^[A-Z0-9@⚠][A-Z0-9a-z]*$/.test(cursor.name)) {
                    has_a_child = true;
                  }
                } while (cursor.nextSibling());
              } finally {
                cursor.parent();
              }
              if (!has_a_child) {
                let lines_till_error = parser_code
                  .slice(0, cursor.from)
                  .split("\n");
                let line = lines_till_error.length;
                let col = lines_till_error[line - 1].length;
                throw new Error(`Empty Body ${line}:${col}`);
              }
            } else {
              throw new Error(`Empty Body (add line:col here)`);
            }
          }
        },
      });

      // Build the parser file first
      let start = Date.now();
      try {
        let worker = get_lezer_worker(signal);

        let parser = await worker.request("build-parser", {
          code: parser_code,
        });

        let time = Date.now() - start;

        return { parser, time };
      } catch (e) {
        console.error(
          `Error while running build-parser in the worker:`,
          e instanceof Error ? e.stack : e
        );
        throw e;
      }
    },
    [parser_code, get_lezer_worker, do_run]
  );

  let generated_parser_code = React.useMemo(
    () => generated_parser.map((x) => x.parser),
    [generated_parser]
  );
  let generated_parser_time = React.useMemo(
    () => generated_parser.map((x) => x.time),
    [generated_parser]
  );

  return { generated_parser_code, generated_parser_time };
};

/**
 * @param {{
 *  do_run: boolean;
 *  generated_parser_code: ExecutionResult<any>;
 *  javascript_stuff: string,
 * }} props
 */
export let useJavascriptResult = ({
  do_run,
  generated_parser_code,
  javascript_stuff,
}) => {
  let babel_worker = useWorker(() => new TransformJavascriptWorker(), []);

  let terms_file_result = usePromise(
    async (signal) => {
      if (babel_worker == null) {
        throw Loading.of();
      }
      if (generated_parser_code instanceof Failure) {
        throw new Error("Failed to parser.terms.js");
      }

      let { terms: terms_code_raw, parser: parser_code_raw } =
        generated_parser_code.get();

      let terms_code = await babel_worker.request("transform-code", {
        code: terms_code_raw,
      });
      // Run the terms file
      try {
        return await run_cell_code(terms_code.code, {});
      } catch (error) {
        console.error(`Error while running terms file:`, error);
        throw error;
      }
    },
    [generated_parser_code, babel_worker]
  );

  let javascript_result = usePromise(
    async (signal) => {
      if (!do_run) {
        throw new Error("Not running");
      }

      if (babel_worker == null) {
        throw Loading.of();
      }

      // Run the javascript file,
      // with the terms file as a possible import
      let our_javascript_code = await babel_worker.request("transform-code", {
        code: javascript_stuff,
      });

      let load_terms_file = async () => {
        if (terms_file_result instanceof Failure) {
          // prettier-ignore
          throw new TypeError(`Failed to resolve module specifier './parser.terms.js'`);
        }
        if (terms_file_result instanceof Loading) {
          throw new TermsFileNotReadyError();
        }
        return terms_file_result.get();
      };

      let import_map = {
        "@lezer/highlight": () => import("@lezer/highlight"),
        "@codemirror/language": () => import("@codemirror/language"),
        "@codemirror/view": () => import("@codemirror/view"),
        "@codemirror/state": () => import("@codemirror/state"),
        "style-mod": () => import("style-mod"),
        "@lezer/lr": () => import("@lezer/lr"),
        "@lezer/common": () => import("@lezer/common"),
      };

      try {
        let untyped_result = await run_cell_code(our_javascript_code.code, {
          __meta__: {
            // prettier-ignore
            url: new URL("./lezer-playground.js", window.location.href).toString(),
            import: async (specifier, imported) => {
              if (
                specifier.endsWith(".terms.js") ||
                specifier.endsWith(".terms")
              ) {
                return await load_terms_file();
              }

              let fn = import_map[specifier];
              if (fn == null)
                return verify_imported(
                  imported,
                  await import(/* @vite-ignore */ specifier)
                );
              return verify_imported(imported, await fn());
            },
          },
        });
        return /** @type {{ export: { extensions: Array<import("@codemirror/state").Extension> } }} */ (
          untyped_result
        );
      } catch (error) {
        if (error instanceof TermsFileNotReadyError) {
          throw Loading.of();
        } else {
          throw error;
        }
      }
    },
    [
      terms_file_result,
      babel_worker,
      javascript_stuff,
      terms_file_result,
      do_run,
    ]
  );
  return { javascript_result };
};

/**
 * @param {{
 *  do_run: boolean;
 *  generated_parser_code: ExecutionResult<{ parser: string; terms: string; }>;
 *  javascript_result: ExecutionResult<any>
 * }} props
 */
export let useLezerInstantiated = ({
  do_run,
  generated_parser_code,
  javascript_result,
}) => {
  let babel_worker = useWorker(() => new TransformJavascriptWorker(), []);

  let parser_not_configured = usePromise(async () => {
    if (babel_worker == null) {
      throw Loading.of();
    }
    if (generated_parser_code instanceof Failure) {
      throw new Error("Failed to compile lezer grammar");
    }

    let parser_code_raw = generated_parser_code.get().parser;

    let code_i_can_run = await babel_worker.request("transform-code", {
      code: parser_code_raw,
    });
    let parser_result = await run_cell_code(code_i_can_run.code, {
      __meta__: {
        url: new URL("./lezer/parser.js", window.location.href).toString(),
        import: (specifier, requested) => {
          if (specifier === "@lezer/lr") {
            return import("@lezer/lr");
          } else {
            if (javascript_result instanceof Failure) {
              // prettier-ignore
              throw new Error(`You are trying to import "${specifier}", but the javascript failed to run.`);
            } else if (javascript_result instanceof Loading) {
              // TODO Specific error?
              throw new Error("Loading javascript");
            }
            let exported_from_js = javascript_result.get().export;
            for (let request of requested) {
              if (exported_from_js[request] == null) {
                throw new Error(`Variable "${request}" not exported from "${specifier}".
"${specifier}" is referenced in your lezer grammar, and in this playground that means it is imported from the "javascript stuff" file.`);
              }
            }
            return exported_from_js;
          }
        },
      },
    });

    return /** @type {LRParser} */ (parser_result.export.parser);
  }, [generated_parser_code, babel_worker, javascript_result]);

  return { parser_not_configured };
};
