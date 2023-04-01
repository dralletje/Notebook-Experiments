import "polyfills";
import { throttle } from "lodash-es";
import pc from "picocolors";

import { html, md } from "./leaf/html.js";
import { ExecutionResult } from "./parts/notebook-step.js";
import { Notebook } from "./types.js";
import { serialize } from "./parts/serialize";
import { StacklessError } from "./leaf/StacklessError.js";

import { Engine } from "./parts/engine.js";

let serialize_with_default = ({ value, fallback, context }) => {
  try {
    return serialize(value, context);
  } catch (error) {
    console.log(pc.red(pc.bold(`COULDN'T SERIALIZE:`)));
    console.log(pc.red(error.stack));
    console.log(pc.blue(`value:`), value);
    return serialize(fallback, globalThis);
  }
};

let engine_to_json = (engine: Engine) => {
  return {
    cylinders: Object.fromEntries(
      engine.cylinders.entries().map(([id, cylinder]) => [
        id,
        {
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
        },
      ])
    ),
  };
};

let engine = new Engine(async function RUN_CELL({
  id,
  inputs,
  code,
  signal,
}): Promise<{ result: ExecutionResult }> {
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

  let func_name = `CELL_${id}`;

  // TODO Split up this try/catch into one for code compilation,
  // .... and one for code execution
  try {
    let fn = new Function(...inputs_array.map((x) => x[0]), code);

    try {
      Object.defineProperty(fn, "name", {
        value: func_name,
      });
    } catch {}

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
    let name_index = error.stack.lastIndexOf(`\n    at Engine.RUN_CELL`);
    if (name_index !== -1) {
      error.stack = error.stack.slice(0, name_index);
    }
    error.stack = error.stack.replace(
      /$\n    at ConstructedFunction (.*)$/gm,
      ""
    );

    return {
      result: {
        type: "throw",
        value: error,
      },
    };
  }
});

engine.addEventListener("log", (event) => {
  postMessage({
    type: "add-log",
    log: event.log,
  });
});

let throttled_postmessage = throttle(postMessage);

engine.addEventListener("change", (event) => {
  let target_huh = event.target ?? event.currentTarget;
  throttled_postmessage({
    type: "update-engine",
    engine: engine_to_json(target_huh),
  });
});

type CircuitMessage = {
  type: "update-notebook";
  notebook: Notebook;
};

addEventListener("message", async (event) => {
  let message: CircuitMessage = event.data;
  if (message.type === "update-notebook") {
    let { notebook } = message;
    engine.update(notebook);
  }
});
