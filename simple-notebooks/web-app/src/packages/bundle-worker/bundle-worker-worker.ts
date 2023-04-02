import "polyfills";
import { throttle } from "lodash-es";
import pc from "picocolors";

import { html, md } from "@dral/javascript-basic-serialize/html";
import { serialize } from "@dral/javascript-basic-serialize";

import {
  Engine,
  notebook_to_string,
  StacklessError,
} from "@dral/javascript-notebook-runner";
import type {
  Notebook,
  ExecutionResult,
} from "@dral/javascript-notebook-runner";

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

function deepFreeze(object) {
  if (Object.isFrozen(object)) return;

  try {
    Object.freeze(object);
    const propNames = Reflect.ownKeys(object);

    // Freeze properties before freezing self
    for (const name of propNames) {
      const value = object[name];

      if ((value && typeof value === "object") || typeof value === "function") {
        deepFreeze(value);
      }
    }
  } catch {}
}

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
      let url = new URL(specifier, "https://jspm.dev/");
      return await import(url.toString());
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

    // I am going on a limb here, and freezing everything we get back.
    // This is to prevent the user from modifying the result of a cell in another cell.
    // Lets see if that actually works/feels good.
    // TODO Add some feature-flags-kinda thing to the UI to toggle this.
    // FEATURE_FLAG: freeze_results
    deepFreeze(result);

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

    // let parsed = engine.parse_cache.parse_notebook(notebook.cells);
    // let thing = notebook_to_string(notebook, parsed);
    // console.log(`{thing}:`, { thing });
  }
});
