import "polyfills";
import { isEqual, throttle } from "lodash-es";
import pc from "picocolors";

import { html, md } from "@dral/javascript-basic-serialize/html";
import { serialize } from "@dral/javascript-basic-serialize";

import { Engine, StacklessError } from "@dral/javascript-notebook-runner";
import {
  Notebook,
  ExecutionResult,
  SheetArchitect,
} from "@dral/javascript-notebook-runner";
import { enablePatches, produceWithPatches } from "immer";
import { TypedEventTarget } from "@dral/typed-event-target";

enablePatches();

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
      let url = new URL(specifier, "https://jspm.dev/");
      return await import(/* @vite-ignore */ url.toString());
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
    // deepFreeze(result);

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
    try {
      let name_index = error.stack.lastIndexOf(`\n    at Engine.RUN_CELL`);
      if (name_index !== -1) {
        error.stack = error.stack.slice(0, name_index);
      }
      error.stack = error.stack.replace(
        /$\n    at ConstructedFunction (.*)$/gm,
        ""
      );
    } catch {}

    return {
      result: {
        type: "throw",
        value: error,
      },
    };
  }
});

export class UpdateEngineEvent extends Event {
  patches: any;
  constructor(patches: any) {
    super("update-engine");
    this.patches = patches;
  }
}
export class LogEvent extends Event {
  log: any;
  constructor(log: any) {
    super("log");
    this.log = log;
  }
}

export let outgoing = new TypedEventTarget<{
  "update-engine": UpdateEngineEvent;
  log: LogEvent;
}>();

// TODO Throttle?
engine.addEventListener("log", (event) => {
  outgoing.dispatchEvent(new LogEvent(event.log));
});

let throttled_change = throttle((fn) => fn(), 100, {
  leading: true,
  trailing: true,
});

let last_engine = null;

engine.addEventListener("change", (event) => {
  let target_huh = event.target ?? event.currentTarget;

  throttled_change(() => {
    let current_engine = engine_to_json(target_huh);
    // @ts-ignore
    let [new_value, patches] = produceWithPatches(last_engine, (draft) => {
      if (last_engine == null) return current_engine;
      for (let key in current_engine.cylinders) {
        if (
          !isEqual(last_engine.cylinders[key], current_engine.cylinders[key])
        ) {
          draft.cylinders[key] = current_engine.cylinders[key];
        }
      }
    });
    last_engine = current_engine;

    outgoing.dispatchEvent(new UpdateEngineEvent(patches));
  });
});

let architect = new SheetArchitect();

export let onUpdateNotebook = async ({ notebook }: { notebook: Notebook }) => {
  // let start = performance.now();
  let blueprint = architect.design(notebook);
  // let end = performance.now();
  // console.log(`Blueprint took ${end - start}ms`);
  engine.update(blueprint);

  // let thing = notebook_to_string(notebook, blueprint);
};
