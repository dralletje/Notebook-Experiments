import "polyfills";
import { mapValues, throttle } from "lodash-es";

import { html, md } from "./leaf/html.js";
import { ExecutionResult, notebook_step } from "./parts/notebook-step.js";
import { Engine, Notebook } from "./types.js";

let run_cell = async ({
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
  onChange: (engine: Engine) => void
) => {
  let did_change = true;
  while (did_change === true) {
    did_change = false;

    // TODO This shouldn't be here, run_notebook shouldn't very much care
    // .... about what is in an engine
    for (let [cell_id, cell] of Object.entries(notebook_ref.current.cells)) {
      engine.cylinders[cell_id] ??= {
        id: cell_id,
        name: cell_id,
        last_run: -Infinity,
        last_internal_run: -Infinity,
        running: false,
        waiting: false,
        result: {
          type: "return",
          value: { 0: { type: "undefined", value: "" } },
        },
        variables: {},
        upstream_cells: [],
        abort_controller: null,
      };
    }

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
    });
    onChange(engine);
  }
};

let engine_to_json = (engine) => {
  return {
    cylinders: mapValues(engine.cylinders, (cylinder) => ({
      name: cylinder.name,
      result: cylinder.result,
      last_run: cylinder.last_run,
      running: cylinder.running,
      waiting: cylinder.waiting,
    })),
  };
};

let engine = {
  cylinders: {},
  internal_run_counter: 1,
  dag: {},
  is_busy: false,
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
      })
    );
    engine.is_busy = false;
  }
});
