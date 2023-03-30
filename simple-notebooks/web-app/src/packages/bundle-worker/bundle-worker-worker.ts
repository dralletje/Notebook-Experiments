import "polyfills";
import { mapValues, throttle } from "lodash-es";
import chalk from "chalk";

import { html, md } from "./leaf/html.js";
import {
  ExecutionResult,
  RunCellFunction,
  notebook_step,
} from "./parts/notebook-step.js";
import { Engine, EngineRunCountTracker, Notebook } from "./types.js";
import { serialize } from "./parts/serialize";
import { StacklessError } from "./leaf/StacklessError.js";

let serialize_with_default = ({ value, fallback, context }) => {
  try {
    return serialize(value, context);
  } catch (error) {
    console.log(chalk.red.bold`COULDN'T SERIALIZE:`);
    console.log(chalk.red(error.stack));
    console.log(chalk.blue`value:`, value);
    return serialize(fallback, globalThis);
  }
};

let run_cell: RunCellFunction = async ({
  inputs,
  code,
  signal,
}): Promise<{ result: ExecutionResult }> => {
  let url = new URL("https://dral.eu/app.js");
  inputs.__meta__ = {
    is_in_notebook: true,
    signal: signal,
    url: url,
    import: async (specifier: any) => {
      return await import(`https://jspm.dev/${specifier}`);
    },
  };

  let inputs_array = Object.entries({
    html: html,
    md: md,
    ...inputs,
  });

  // TODO Split up this try/catch into one for code compilation,
  // .... and one for code execution
  try {
    let fn = new Function(...inputs_array.map((x) => x[0]), code);

    let result = await fn(...inputs_array.map((x) => x[1]));

    // TODO Dirty hack to make `Couldn't return-ify X` errors stackless
    if (result.default instanceof SyntaxError) {
      result.default = new StacklessError(result.default);
    }

    return {
      result: {
        type: "return",
        value: result,
      },
    };
  } catch (error) {
    return {
      result: {
        type: "throw",
        value: error,
      },
    };
  }
};

let run_notebook = async (
  filename: string,
  notebook_ref: { current: Notebook },
  engine: Engine,
  onChange: (engine: Engine) => void,
  onLog: (engine: any) => void
) => {
  let did_change = true;
  while (did_change === true) {
    did_change = false;

    await notebook_step({
      engine,
      filename: filename,
      notebook: notebook_ref.current,
      run_cell: run_cell,
      onChange: (fn) => {
        did_change = true;
        fn(engine);
        onChange(engine);
      },
      onLog: onLog,
    });
    onChange(engine);
  }
};

let engine_to_json = (engine: Engine) => {
  try {
    return {
      cylinders: mapValues(engine.cylinders, (cylinder) => ({
        name: cylinder.id,
        last_run: cylinder.last_run,
        running: cylinder.running,
        waiting: cylinder.waiting,
        last_internal_run: cylinder.last_internal_run,
        result: {
          ...cylinder.result,
          value: serialize_with_default({
            value: cylinder.result.value,
            fallback: new StacklessError(`Couldn't serialize value`),
            context: globalThis,
          }),
        },
      })),
    };
  } catch (error) {
    console.log(`error:`, error);
  }
};

let engine: Engine = {
  cylinders: {},
  internal_run_counter: 1 as EngineRunCountTracker,
  // graph: new Map(),
  is_busy: false,
  parse_cache: new Map(),
};

let notebook_ref = { current: null as Notebook | null };

type CircuitMessage = {
  type: "update-notebook";
  notebook: Notebook;
};

addEventListener("message", async (event) => {
  let message: CircuitMessage = event.data;
  if (message.type === "update-notebook") {
    let { notebook } = message;
    // notebook_ref = { current: notebook.notebook };
    notebook_ref.current = notebook;

    if (engine.is_busy) return;
    engine.is_busy = true;

    await run_notebook(
      "app.ts", // notebook.filename
      notebook_ref as any,
      engine,
      // Throttle to do at most on every tick
      // Could make this bigger if I get too many events
      throttle((engine) => {
        let x = engine_to_json(engine);
        postMessage({
          type: "update-engine",
          engine: x,
        });
      }),
      (log) => {
        postMessage({
          type: "add-log",
          log: log,
        });
      }
    );
    engine.is_busy = false;
  }
});
