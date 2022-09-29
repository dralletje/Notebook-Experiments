import chalk from "chalk";
import { mapValues, omit, compact, without } from "lodash-es";
import fetch from "node-fetch";
import domain from "domain";
import { html, md } from "./html.js";

import {
  cells_to_dag,
  collect_downstream,
  cyclical_groups,
  double_definitions,
  expand_dag,
  GraphCell,
  topological_sort,
} from "./dag-things.js";

import { run_in_environment } from "../cell-environment/cell-environment.js";
import { parse_cell } from "./parse-cell.js";
import serialize from "./serialize.js";
import { Engine, Notebook } from "./node-engine.js";

let create_callback_collector = () => {
  let callbacks = [];
  let add = Object.assign(
    (callback) => {
      callbacks.push(callback);
    },
    {
      then: (fn) => {
        add(() => fn());
        return add.then;
      },
    }
  );
  return {
    add: add,
    call: async (...args) => {
      for (let callback of callbacks) {
        await callback(...args);
      }
    },
  };
};

let cells_that_need_running = (notebook: Notebook, engine: Engine) => {
  let graph_cells = notebook_to_graph_cell(notebook);
  let dag = expand_dag(cells_to_dag(graph_cells));
  let sorted = topological_sort(dag);

  // MULTIPLE DEFINITIONS
  // TODO Move this to a separate step?
  let doubles = double_definitions(graph_cells);
  sorted = without(
    sorted,
    ...doubles.flatMap(([variable_name, cells]) => cells.map((x) => x.id))
  );
  for (let [variable_name, cells] of doubles) {
    let error_message = `Variable ${variable_name} is defined multiple times`;
    let error = new Error(error_message);
    error.stack = "";

    for (let cell of cells) {
      // TODO onChange?
      engine.cylinders[cell.id].result = {
        type: "throw",
        value: serialize(error, global),
      };
    }
  }

  // CYCLICAL DEPENDENCIES
  // TODO Move this to a separate step?
  // let cyclicals = cyclical_groups(dag);
  // console.log(`cyclicals:`, cyclicals);
  // sorted = without(sorted, ...cyclicals.flat());
  // for (let group of cyclicals) {
  //   let error_message = `Cyclical dependency: ${group.join(" -> ")}`;
  //   let error = new Error(error_message);
  //   error.stack = "";

  //   for (let cell_id of group) {
  //     // TODO onChange?
  //     engine.cylinders[cell_id].result = {
  //       type: "throw",
  //       value: serialize(error, global),
  //     };
  //   }
  // }

  let deleted_cells = [];
  for (let cylinder of Object.values(engine.cylinders)) {
    if (cylinder.id in notebook.cells === false) {
      deleted_cells.push(cylinder.id);
    }
  }

  let cell_should_run_at_map = {};
  let cells_that_should_run = [];
  for (let deleted_cell of deleted_cells) {
    cell_should_run_at_map[deleted_cell] = Infinity;
    cells_that_should_run.push(deleted_cell);
  }
  for (let cell_id of sorted) {
    let cell = notebook.cells[cell_id];
    let cylinder = engine.cylinders[cell_id];

    if (cell.last_run == null) {
      // Eh?
      continue;
    }

    // No last_run? Definitely should run!!
    if (cylinder?.last_run == null) {
      throw new Error("Shouldn't happen!");
      cell_should_run_at_map[cell_id] = Infinity;
      cells_that_should_run.push(cell_id);
      continue;
    }

    // Cell has been sent to be re-run, also run it!
    if ((cell.last_run ?? -Infinity) > (cylinder.last_run ?? -Infinity)) {
      cell_should_run_at_map[cell_id] = Infinity;
      cells_that_should_run.push(cell_id);
      continue;
    }

    // Here comes the tricky part: I need to "carry over" the `should_run` times from the parent cells.
    let should_run_at = Math.max(
      cylinder.last_internal_run,
      ...dag[cell_id].in.map((parent_id) => cell_should_run_at_map[parent_id]),
      ...cylinder.upstream_cells.map(
        (parent_id) => cell_should_run_at_map[parent_id] ?? Infinity
      )
    );
    cell_should_run_at_map[cell_id] = should_run_at;

    if (should_run_at > cylinder.last_internal_run) {
      cells_that_should_run.push(cell_id);
    }
  }

  return cells_that_should_run;
};

let notebook_to_graph_cell = (notebook: Notebook): GraphCell[] => {
  return compact(
    notebook.cell_order.map((cell_id) => {
      let cell = notebook.cells[cell_id];

      if (cell.type === "text") {
        return null;
      }

      let parsed = parse_cell(cell);
      if ("output" in parsed) {
        return {
          id: cell_id,
          exports: parsed.output.created_names,
          imports: parsed.output.consumed_names,
        };
      } else {
        return null;
      }
    })
  );
};

export let notebook_step = async (
  engine: Engine,
  notebook: Notebook,
  onChange: (mutate: (engine: Engine) => void) => void
) => {
  let graph_cells = notebook_to_graph_cell(notebook);
  let dag = expand_dag(cells_to_dag(graph_cells));

  let cells_to_run = cells_that_need_running(notebook, engine);
  // TODO Mark every `cells_to_run` as pending!

  for (let cylinder of Object.values(engine.cylinders)) {
    let should_be_waiting = cells_to_run.includes(cylinder.id);
    if (cylinder.waiting !== should_be_waiting) {
      onChange((engine) => {
        engine.cylinders[cylinder.id].waiting = should_be_waiting;
      });
    }
  }

  let cell_to_run = cells_to_run[0];

  // let cell_to_run = get_next_cell_to_run(engine, notebook);
  if (cell_to_run != null) {
    let key = cell_to_run;
    let cell = notebook.cells[key];

    // Cell has been deleted!
    // Gently ask it to stop existing and move on.
    if (cell == null) {
      await engine.cylinders[cell_to_run].invalidation_token?.call?.();
      onChange(() => {
        delete engine.cylinders[cell_to_run];
      });
      return;
    }

    let parsed = parse_cell(cell);

    onChange((engine) => {
      engine.cylinders[key] = {
        ...engine.cylinders[key],
        last_run: cell.last_run,
        last_internal_run: engine.internal_run_counter++,
        upstream_cells: dag[key].in,
        running: true,
        waiting: false,
      };
    });

    let cylinder = engine.cylinders[key];
    if ("error" in parsed) {
      let _parsed = parsed;
      // Error while parsing the code, so we run it to get the javascript error
      onChange(() => {
        engine.cylinders[key] = {
          ...engine.cylinders[key],
          last_run: cell.last_run,
          result: {
            type: "throw",
            value: serialize(_parsed.error, global),
          },
          running: false,
          upstream_cells: [],
          variables: {},
        };
      });
      return;
    }
    if (!("output" in parsed)) {
      onChange((engine) => {
        engine.cylinders[key] = {
          ...engine.cylinders[key],
          last_run: cell.last_run,
          result: {
            type: "throw",
            value: serialize(new Error("Something is wronnnggggg"), global),
          },
          running: false,
          upstream_cells: [],
          variables: {},
        };
      });
      return;
    }

    let { code, consumed_names, last_created_name } = parsed.output;
    console.log(chalk.blue.bold`RUNNING CODE:`);
    console.log(chalk.blue(code));

    let inputs = {} as any;
    for (let name of consumed_names) {
      for (let cylinder of Object.values(engine.cylinders)) {
        if (name in (cylinder.variables ?? {})) {
          inputs[name] = cylinder.variables[name];
        }
      }
    }

    // If there was a previous run, allow performing cleanup.
    // TODO Ideally this has a nicer abstraction.
    await cylinder.invalidation_token?.call();

    let invalidation_token = create_callback_collector();
    // This is outside the onChange because it doesn't go to the client at all...
    // maybe it is better for strictness? TODO
    cylinder.invalidation_token = invalidation_token;
    inputs.invalidation = invalidation_token.add;

    // Adding AbortController too, but it is sync so might not cover all cases.
    // (I specifically added `invalidation(async () => {}))` because express didn't shut down directly.
    let abort_controller = new AbortController();
    invalidation_token.add(() => {
      abort_controller.abort();
    });
    inputs.signal = abort_controller.signal;

    inputs.__meta__ = {
      is_in_notebook: true,
      url: new URL("../cell-environment/cell-environment.js", import.meta.url),
    };

    inputs.fetch = fetch;
    inputs.html = html;
    inputs.md = md;

    // DOMAINS ARE JUST A HACK
    // We need to move the actual code running to a separate process
    // anyway, so don't rely on this!
    let cell_domain = domain.create();
    cell_domain.on("error", (error) => {
      console.error("ERROR CAUGHT IN CELL!", error);
      // TODO Don't override the existing result?
      // Where do we show errors like this???
      onChange((engine) => {
        engine.cylinders[key].result = {
          type: "throw",
          value: serialize(error, global),
        };
      });
    });
    let result = await cell_domain.run(async () => {
      try {
        let inputs_array = Object.entries(inputs);
        let fn = run_in_environment(
          inputs_array.map((x) => x[0]),
          code
        );

        console.log(fn);

        let result = await fn(...inputs_array.map((x) => x[1]));

        return {
          type: "return",
          value: result,
        };
      } catch (error) {
        return {
          type: "throw",
          value: error,
        };
      }
    });

    onChange((engine) => {
      engine.cylinders[key] = {
        ...engine.cylinders[key],
        result:
          result.type === "return"
            ? {
                type: "return",
                name: last_created_name,
                value: try_with_default(
                  () => serialize(result.value?.default, global),
                  { 0: { type: `couldn't serialize` } }
                ),
              }
            : result.type === "throw"
            ? {
                type: "throw",
                value: try_with_default(() => serialize(result.value, global), {
                  0: { type: `couldn't serialize` },
                }),
              }
            : { type: "pending" },
        running: false,
        variables:
          result.type === "return" ? omit(result.value, "default") : {},
      };
    });
  }
};

let try_with_default = (fn, def) => {
  try {
    return fn();
  } catch (error) {
    console.log(
      chalk.red.bold`Couldn't serialize error:`,
      chalk.red(error.stack)
    );
    return def;
  }
};
