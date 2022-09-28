import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import chalk from "chalk";

import { mapValues, omit, dropRightWhile } from "lodash-es";

import { transform_code } from "run-javascript";
import serialize from "./serialize.js";
import domain from "domain";

import * as stacktraceparser from "stacktrace-parser";
import { SourceMapConsumer } from "source-map";
import { cells_to_dag, get_next_cell_to_run } from "./dag-things.js";

import { run_in_environment } from "../cell-environment/cell-environment.js";
import { html, md } from "./html.js";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/**
 * @template T
 * @template E
 * @typedef Result
 * @type {{ type: "return", name: string?, value: T } | { type: "throw", value: E } | { type: "pending" }}
 */

/**
 * @typedef Serialized
 * @type {{ [id: number]: { type: string, value: any } }}
 */

/**
 * @typedef CellId
 * @type {string}
 */

/**
 * @typedef Engine
 * @property {{ [cell_id: CellId]: Cylinder }} cylinders
 * @property {number} internal_run_counter
 * @property {{ [key: CellId]: DAGElement }} dag
 *
 * @typedef Cylinder
 * @property {string} id
 * @property {string} name
 * @property {number} last_run
 * @property {number} last_internal_run
 * @property {boolean} running
 * @property {Result<Serialized, Serialized>} result
 * @property {{ [name: string]: any }} variables
 * @property {Array<CellId>} upstream_cells
 * @property {{ call: () => Promise }} invalidation_token
 * @property {{
 *  input: string,
 *  output: { code: string, consumed_names: string[], created_names: string[], last_created_name: string?, map: any },
 *  error?: null,
 * } | {
 *  input: string,
 *  output?: null,
 *  error: Error,
 * }} __transformed_code_cache__
 */

/**
 * @typedef Notebook
 * @type {{ cells: { [key: CellId]: Cell } }}
 *
 * @typedef Cell
 * @type {{ code: string, last_run: number, id: CellId }}
 */

/**
 * @typedef DAGElement
 * @property {CellId} id
 * @property {Array<DAGElement>} in
 * @property {Array<DAGElement>} out
 */

let create_callback_collector = () => {
  let callbacks = [];
  let add = (callback) => {
    callbacks.push(callback);
  };
  add.then = (fn) => {
    add(() => fn());
    return add.then;
  };
  return {
    add: add,
    call: async (...args) => {
      for (let callback of callbacks) {
        await callback(...args);
      }
    },
  };
};

/**
 * @param {Engine} engine
 * @param {Notebook} notebook
 * @param {(mutate: (engine: Engine) => void) => void} onChange
 */
let notebook_step = async (engine, notebook, onChange) => {
  // First remove cells!
  // Not sure why, but feels good.
  let cells_to_remove = Object.keys(engine.cylinders).filter(
    (id) => !(id in notebook.cells)
  );
  if (cells_to_remove.length > 0) {
    let cell_id = cells_to_remove[0];
    await engine.cylinders[cell_id].invalidation_token?.call?.();
    onChange(() => {
      delete engine.cylinders[cell_id];
    });
    return;
  }

  let cell_to_run = get_next_cell_to_run(engine, notebook);
  if (cell_to_run != null) {
    let [key, cell] = cell_to_run;

    onChange((engine) => {
      // Reset this cylinders upstream cells before we calculate the new
      // upstream cells, because previous upstream cells will be taken into account.
      if (engine.cylinders[key] != null) {
        engine.cylinders[key].upstream_cells = [];
      }
      let dag = cells_to_dag(notebook, engine);
      let cell_to_run_in_dag = dag[key];

      engine.cylinders[key] = {
        ...engine.cylinders[key],
        last_run: cell.last_run,
        last_internal_run: engine.internal_run_counter++,
        upstream_cells: cell_to_run_in_dag.in.map((x) => x.id),
        running: true,
      };
    });

    let cylinder = engine.cylinders[key];
    if (cylinder.__transformed_code_cache__.error != null) {
      // Error while parsing the code, so we run it to get the javascript error
      onChange((engine) => {
        engine.cylinders[key] = {
          ...engine.cylinders[key],
          last_run: cell.last_run,
          result: {
            type: "throw",
            value: serialize(cylinder.__transformed_code_cache__.error, global),
          },
          running: false,
          upstream_cells: [],
          variables: {},
        };
      });
      return;
    }
    if (cylinder.__transformed_code_cache__.output == null) {
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

    let {
      code,
      consumed_names,
      created_names,
      last_created_name,
      map: sourcemap,
    } = cylinder.__transformed_code_cache__.output;
    console.log(chalk.blue.bold`RUNNING CODE:`);
    console.log(chalk.blue(code));

    let inputs = {};
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
                value: try_with_default(
                  () =>
                    serialize(
                      fix_error_from_sourcemap(result.value, sourcemap),
                      global
                    ),
                  {
                    0: { type: `couldn't serialize` },
                  }
                ),
              }
            : { type: "pending" },
        running: false,
        variables:
          result.type === "return" ? omit(result.value, "default") : {},
      };
    });
  }
};

/** @param {Cylinder} cylinder */
let filename_from_parsed = (cylinder) => {
  let created_names =
    cylinder.__transformed_code_cache__.output?.created_names ?? [];
  let names = created_names.length === 0 ? [cylinder.id] : created_names;
  return names.join("-and-");
};

let fix_error_from_sourcemap = (error, sourcemap) => {
  if (error.stack == null) {
    return error;
  }

  console.log(chalk.yellow.bold`RUNNING ERROR:`, chalk.yellow(error.stack));

  // Until I figure out/fix recast
  if (sourcemap == null) {
    return error;
  }

  var smc = new SourceMapConsumer(sourcemap);
  let stack = stacktraceparser.parse(error.stack);
  // console.log(smc.originalPositionFor({
  //   line: 3,
  //   column: 15
  // }));
  let stack_without_internals = dropRightWhile(stack, (frame) => {
    return frame.file !== sourcemap.sources[0];
  }).slice(0, -1);

  let stacks_with_correct_positions = stack_without_internals.map((frame) => {
    if (frame.file === sourcemap.sources[0]) {
      let { line, column } = smc.originalPositionFor({
        // @ts-ignore
        line: frame.lineNumber,
        // @ts-ignore
        column: frame.column,
      });
      return {
        ...frame,
        lineNumber: line,
        column: column,
      };
    } else {
      return frame;
    }
  });

  error.stack =
    `${error.toString()}\n` +
    stacks_with_correct_positions.map((frame) => {
      return `  at #${frame.file}:${frame.lineNumber}:${frame.column}`;
    });

  console.log(chalk.magenta.bold`error.stack:`, chalk.magenta(error.stack));

  return error;
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

/**
 * @param {Notebook} notebook
 * @param {Engine} engine
 */
let parse_all_cells = (notebook, engine) => {
  for (let [key, cell] of Object.entries(notebook.cells)) {
    let cylinder = engine.cylinders[key] ?? { id: key };

    if (cylinder.__transformed_code_cache__?.input === cell.code) {
      continue;
    }

    try {
      let { code, consumed_names, created_names, last_created_name, map } =
        transform_code(cell.code, {
          filename: `${cell.id}.js`,
        });
      cylinder.__transformed_code_cache__ = {
        input: cell.code,
        output: {
          code,
          map,
          consumed_names,
          created_names,
          last_created_name,
        },
      };
    } catch (error) {
      console.log(chalk.red.bold`ERROR PARSING:`, chalk.red(error.stack));
      console.log(chalk.red(cell.code));

      if (error.code === "BABEL_PARSER_SYNTAX_ERROR") {
        error.message = `${error.message} at ${error.loc.line}:${error.loc.column}`;
      }

      cylinder.__transformed_code_cache__ = {
        input: cell.code,
        output: null,
        error: error,
      };
    }

    cylinder.id = key;
    cylinder.name = filename_from_parsed(cylinder);

    engine.cylinders[key] = cylinder;
  }

  let dag = cells_to_dag(notebook, engine);
  engine.dag = dag;

  return engine;
};

let run_notebook = async (notebook_ref, engine, onChange) => {
  let did_change = true;
  while (did_change === true) {
    did_change = false;

    // @ts-ignore
    parse_all_cells(notebook_ref.current, engine);
    await notebook_step(engine, notebook_ref.current, (fn) => {
      did_change = true;
      fn(engine);
      onChange(engine);
    });
  }
};

io.on("connection", (socket) => {
  let is_busy = false;
  /** @type {{ current: Notebook }} */
  let notebook_ref = { current: { cells: {} } };

  /** @type {Engine} */
  let engine = { cylinders: {}, internal_run_counter: 1, dag: {} };

  socket.on("notebook", async (notebook) => {
    notebook_ref.current = notebook;
    if (is_busy) return;

    is_busy = true;
    await run_notebook(notebook_ref, engine, (engine) => {
      socket.emit("engine", {
        cylinders: mapValues(engine.cylinders, (cylinder) => ({
          name: cylinder.name,
          result: cylinder.result,
          last_run: cylinder.last_run,
          running: cylinder.running,
        })),
        dag: serialize(engine.dag, global),
      });
    });
    is_busy = false;
  });

  socket.on("disconnect", () => {
    console.log(chalk.green.bold`DISCONNECTED`);
    notebook_ref.current = { cells: {} };

    if (!is_busy) {
      run_notebook(notebook_ref, engine, () => {});
    }

    // @ts-ignore
    notebook_ref = null;
  });
});

app.get("/", (req, res) => {
  res.send({
    why_are_you_here: "????",
    you_should_connect_with_websocket: true,
  });
});

server.listen(process.env.PORT ?? 3099, () => {
  console.log("server started");
});
