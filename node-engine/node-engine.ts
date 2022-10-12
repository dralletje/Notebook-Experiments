import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Server } from "socket.io";
import http from "node:http";
import chalk from "chalk";

import { mapValues, throttle } from "lodash-es";

import serialize from "./serialize.js";
import { notebook_step, topological_sort_notebook } from "./notebook-step.js";
import {
  load_notebook,
  NotNotebookError,
  save_notebook,
} from "./save-and-load-notebook-file.js";

import { readdir } from "node:fs/promises";

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

export type DAGElement = {
  id: CellId;
  in: DAGElement[];
  out: DAGElement[];
};

type Result<T, E> =
  | { type: "return"; name?: string; value: T }
  | { type: "throw"; value: E }
  | { type: "pending" };

type Serialized = { [id: number]: { type: string; value: any } };

export type CellId = string;

export type Engine = {
  cylinders: { [cell_id: CellId]: Cylinder };
  internal_run_counter: number;
  dag: { [key: CellId]: DAGElement };
  is_busy: boolean;
};

export type Cylinder = {
  id: CellId;
  name: string;
  last_run: number;
  last_internal_run: number;
  running: boolean;
  waiting: boolean;
  result: Result<Serialized, Serialized>;
  variables: { [name: string]: any };
  upstream_cells: Array<CellId>;
  invalidation_token: { call: () => Promise<any> };
};

export type Notebook = {
  cells: { [key: CellId]: Cell };
  cell_order: CellId[];
};

export type Workspace = {
  files: { [filename: string]: { filename: string; notebook: Notebook } };
};
export type WorkspaceEngine = {
  files: { [filename: string]: Engine };
};

export type Cell = {
  code: string;
  type: "code" | "text";
  last_run: number;
  id: CellId;
};

let run_notebook = async (
  filename: string,
  notebook_ref: { current: Notebook },
  engine: Engine,
  onChange: (engine: Engine) => void
) => {
  let onChange_debounced = throttle(onChange, 0);

  let did_change = true;
  while (did_change === true) {
    did_change = false;

    // @ts-ignore
    // parse_all_cells(notebook_ref.current, engine);
    // let dag = cells_to_dag(notebook, engine);
    // engine.dag = dag;
    // return engine;

    for (let [cell_id, cell] of Object.entries(notebook_ref.current.cells)) {
      let cylinder = engine.cylinders[cell_id];
      if (cylinder == null) {
        engine.cylinders[cell_id] = {
          id: cell_id,
          name: cell_id,
          last_run: -Infinity,
          last_internal_run: -Infinity,
          running: false,
          waiting: false,
          result: { type: "pending" },
          variables: {},
          upstream_cells: [],
          invalidation_token: { call: () => Promise.resolve() },
        };
      }
    }

    await notebook_step(
      engine,
      { filename: filename, notebook: notebook_ref.current },
      (fn) => {
        did_change = true;
        fn(engine);
        onChange_debounced(engine);
      }
    );
    onChange_debounced(engine);
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
    dag: serialize(engine.dag, global),
  };
};

let empty_notebook = (): Notebook => ({
  cells: {},
  cell_order: [],
});

let DIRECTORY = `../cell-environment/src`;

io.on("connection", (socket) => {
  let is_busy = false;
  let workspace_ref: { [filename: string]: { current: Notebook } } = {};

  let engines: { [filename: string]: Engine } = {};

  socket.on("load-workspace-from-directory", async () => {
    let files = await readdir(DIRECTORY);
    let workspace: Workspace = {
      files: {},
    };
    for (let file of files) {
      if (file === "__cell_environment.js") continue;
      if (file.endsWith(".js") || file.endsWith(".ts")) {
        try {
          workspace.files[file] = await load_notebook(DIRECTORY, file);
        } catch (error) {
          if (error instanceof NotNotebookError) {
            // Fine
          } else {
            throw error;
          }
        }
      }
    }
    socket.emit("load-workspace-from-directory", workspace);
  });

  socket.on("notebook", async (notebook) => {
    save_notebook(notebook, DIRECTORY).catch((error) => {
      console.error(chalk.bold.red(`Error saving notebook`));
      console.error(error);
    });

    workspace_ref[notebook.filename] = { current: notebook.notebook };
    engines[notebook.filename] ??= {
      cylinders: {},
      internal_run_counter: 1,
      dag: {},
      is_busy: false,
    };
    let engine = engines[notebook.filename];

    if (engine.is_busy) return;
    engine.is_busy = true;

    await run_notebook(
      notebook.filename,
      workspace_ref[notebook.filename],
      engine,
      (engine) => {
        socket.emit("engine", {
          filename: notebook.filename,
          engine: engine_to_json(engine),
        });
      }
    );
    engine.is_busy = false;
  });

  // socket.on("save-workspace", async (workspace: Workspace) => {
  //   for (let [filename, notebook] of Object.entries(workspace.files)) {
  //     save_notebook(notebook, filename);
  //   }
  // });

  // Run notebook with all cells removed on disconnect
  socket.on("disconnect", () => {
    console.log(chalk.green.bold`DISCONNECTED`);

    for (let [filename, engine] of Object.entries(engines)) {
      workspace_ref[filename].current = empty_notebook();
      if (!engine.is_busy) {
        run_notebook({ current: empty_notebook() }, engine, () => {});
      }
    }
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
