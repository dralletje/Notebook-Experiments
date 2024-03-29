import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Server } from "socket.io";
import http from "node:http";
import chalk from "chalk";
import { join } from "node:path";

import { mapValues, throttle } from "lodash-es";
import {
  Notebook,
  NotNotebookError,
  ParseCache,
} from "@dral/javascript-notebook-runner";

import { readdir, stat } from "node:fs/promises";
import { fork, exec as exec_callback } from "node:child_process";
import { promisify } from "node:util";
import { load_notebook, save_notebook } from "./save-and-load-notebook-file.js";

const exec = promisify(exec_callback);

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

let read_all_files = async (path: string) => {
  let files = [];
  let read_files_and_add = async (relative: string) => {
    let scanned = await readdir(join(path, relative));

    for (let file of scanned) {
      let full_path = join(relative, file);
      let stat_result = await stat(join(path, full_path));
      if (stat_result.isDirectory()) {
        await read_files_and_add(full_path);
      } else {
        files.push(full_path);
      }
    }
  };

  await read_files_and_add("");

  return files;
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

let empty_notebook = (): Notebook => ({
  cells: {},
  cell_order: [],
});

let stream_seperator = async function* (
  stream: AsyncIterableIterator<Buffer>,
  separator = "\n"
) {
  let current_line = "";
  for await (const chunk of stream) {
    let [first_line, ...lines] = chunk.toString().split(separator);

    current_line = current_line + first_line;

    for (let line of lines) {
      yield current_line;

      current_line = line;
    }
  }
};

const DIRECTORY = new URL(`../cell-environments/src`, import.meta.url).pathname;

let async = async (async) => async();

let create_fork = async (signal, onChange, onLog) => {
  let process = fork(
    new URL(`./Circuit/Circuit.ts`, import.meta.url).pathname,
    [],
    {
      env: {
        FORCE_COLOR: "true",
        NODE_OPTIONS: [
          "--experimental-import-meta-resolve",
          "--experimental-network-imports",
          "--enable-source-maps",
        ].join(" "),
      },
      signal: signal,
      stdio: ["pipe", "pipe", "pipe", "ipc"],

      // Was hoping this wouldn't be necessary, but it is.
      cwd: new URL(`../cell-environments/src`, import.meta.url),
    }
  );

  process.on("spawn", () => {
    async(async () => {
      for await (let line of stream_seperator(
        process.stdout[Symbol.asyncIterator]()
      )) {
        console.log(">", line);
      }
    });
    async(async () => {
      for await (let line of stream_seperator(
        process.stderr[Symbol.asyncIterator]()
      )) {
        console.log("@", line);
      }
    });
  });

  process.on("message", (message: any) => {
    if (message.type === "update-engine") {
      // this.engine = message.engine;
      // this.onChange(this.engine);
      onChange(message.engine);
    }
    if (message.type === "add-log") {
      onLog(message.log);
    }
  });
  return process;
};

class Circuit {
  process: Promise<import("child_process").ChildProcess>;
  parse_cache: ParseCache = new ParseCache();

  constructor(
    public engine: Engine,
    public onChange: (engine: Engine) => void,
    public onLog: (log: any) => void,
    public signal: AbortSignal
  ) {
    this.process = create_fork(
      this.signal,
      (engine) => {
        this.engine = engine;
        this.onChange(engine);
      },
      onLog
    );

    this.engine = engine;
    this.onChange = onChange;
  }

  async update_notebook(notebook: Notebook) {
    (await this.process).send({
      type: "update-notebook",
      notebook: notebook,
    });
  }

  async exit() {
    (await this.process).kill();
  }

  async restart() {
    (await this.process).kill();
    this.process = create_fork(
      this.signal,
      (engine) => {
        this.engine = engine;
        this.onChange(engine);
      },
      this.onLog
    );
  }
}

let save_notebook_throttled = throttle(save_notebook, 1000, {
  leading: true,
  trailing: true,
});

io.on("connection", (socket) => {
  let abort_controller = new AbortController();

  let workspace_ref: { [filename: string]: { current: Notebook } } = {};

  let engines: { [filename: string]: Circuit } = {};

  socket.on("notebook", async (notebook) => {
    workspace_ref[notebook.filename] = { current: notebook.notebook };
    engines[notebook.filename] ??= new Circuit(
      {
        cylinders: {},
        internal_run_counter: 1,
        dag: {},
        is_busy: false,
      },
      (engine) => {
        socket.emit("engine", {
          filename: notebook.filename,
          engine: engine_to_json(engine),
        });
      },
      (log) => {
        socket.emit("add-log", {
          filename: notebook.filename,
          log: log,
        });
      },

      abort_controller.signal
    );

    let circuit = engines[notebook.filename];

    let parsed = circuit.parse_cache.parse_notebook(notebook.notebook.cells);
    save_notebook_throttled(notebook, parsed, DIRECTORY).catch((error) => {
      console.error(chalk.bold.red(`Error saving notebook`));
      console.error(error);
    });

    circuit.update_notebook(notebook.notebook);
  });

  socket.on("restart", async (filename) => {
    engines[filename]?.restart();
  });

  // Run notebook with all cells removed on disconnect
  socket.on("disconnect", () => {
    console.log(chalk.green.bold`DISCONNECTED`);

    for (let [filename, circuit] of Object.entries(engines)) {
      circuit.exit();
    }
  });
});

app.get("/", (req, res) => {
  res.send({
    why_are_you_here: "????",
    you_should_connect_with_websocket: true,
  });
});

app.get("/workspace", async (req, res) => {
  try {
    let files = await read_all_files(DIRECTORY);
    let workspace: Workspace = {
      files: {},
    };

    for (let file of files) {
      if (/\.(t|j)sx?$/.test(file)) {
        try {
          workspace.files[file] = await load_notebook(DIRECTORY, file);
        } catch (error) {
          if (error instanceof NotNotebookError) {
            // Fine
          } else {
            throw error;
          }
        }
      } else {
        // Show other files too?
      }
    }

    res.send(workspace);
  } catch (error) {
    console.error(error);
    res.status(400).send({
      error: error.message,
    });
  }
});

server.listen(process.env.PORT ?? 3099, () => {
  console.log("server started");
});
