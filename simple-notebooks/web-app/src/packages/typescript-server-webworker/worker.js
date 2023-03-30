import {
  createSystem,
  createVirtualTypeScriptEnvironment,
} from "@typescript/vfs";
import { mapKeys, pickBy } from "lodash";
import ts from "typescript";

let _load_file_sync_cache = new Map();
console.log(`_load_file_sync_cache:`, _load_file_sync_cache);

let NOTEBOOK_FILE = "/notebook.ts";

let match = (virtual_fs, path, params = {}) => {
  if (typeof path === "string") {
    path = path.replace(/^\//, "").split("/");
  }

  if (path.length === 0) {
    return [virtual_fs, params];
  }

  if (virtual_fs == null) {
    return null;
  }

  let [current_name, ...other_segments] = path;

  if (current_name in virtual_fs) {
    let next_virtual_fs = virtual_fs[current_name];
    return match(next_virtual_fs, other_segments, params);
  } else {
    let [wildcard_name, next_virtual_fs] = find_wildcard(
      virtual_fs,
      current_name
    );
    if (wildcard_name) {
      return match(next_virtual_fs, other_segments, {
        ...params,
        [wildcard_name]: current_name,
      });
    } else if ("**" in virtual_fs) {
      return [
        virtual_fs["**"],
        {
          ...params,
          "**": path.join("/"),
        },
      ];
    } else {
      return null;
    }
  }
};

let wildcard_regex_cache = new Map();
let find_wildcard = (virtual_fs, path_segment) => {
  let files = Object.keys(virtual_fs);

  for (let filename of files) {
    if (filename.startsWith(":")) {
      let possible_regex_split = filename.split("/");
      if (possible_regex_split.length === 1) {
        return [filename.slice(1), virtual_fs[filename]];
      } else if (possible_regex_split.length >= 3) {
        if (!wildcard_regex_cache.has(filename)) {
          let [wildcard, ...regex_str] = possible_regex_split;
          let regex = RegExp(
            regex_str.slice(0, -1).join("/"),
            regex_str.at(-1)
          );
          wildcard_regex_cache.set(filename, [wildcard, regex]);
        }
        let [wildcard, regex] = wildcard_regex_cache.get(filename);
        if (regex.test(path_segment)) {
          return [wildcard.slice(1), virtual_fs[filename]];
        }
      } else {
        throw new Error(`Malformed filename: "${filename}"`);
      }
    }
  }
  return [null, null];
};

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

let load_file_sync = (url) => {
  if (_load_file_sync_cache.has(url)) {
    let cached = _load_file_sync_cache.get(url);
    if (cached == null) {
      throw new NotFoundError("Not found, from cache");
    } else if (cached instanceof Error) {
      throw cached;
    } else {
      return cached;
    }
  }

  var request = new XMLHttpRequest();
  request.open("GET", url, false); // `false` makes the request synchronous
  request.timeout = 10 * 1000;
  request.send(null);

  if (request.status === 200 && request.responseText != null) {
    // console.log("LOADED FOR THE FIRST TIME", url);
    _load_file_sync_cache.set(url, request.responseText);
    return request.responseText;
  } else if (request.status === 404) {
    let error = new NotFoundError("Not found");
    _load_file_sync_cache.set(url, error);
    throw error;
  } else if (request.status === 403) {
    let error = new NotFoundError("Forbidden");
    _load_file_sync_cache.set(url, error);
    throw error;
  } else {
    let error = new Error(`failed to load ${url}`);
    _load_file_sync_cache.set(url, error);
    throw error;
  }
};

const builtInNodeMods = [
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "dns/promises",
  "domain",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "stream/promises",
  "stream/consumers",
  "stream/web",
  "string_decoder",
  "sys",
  "timers",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
];

let virtual_fs = {
  node_modules: {
    typescript: {
      lib: {
        ":name": ({ name }) => {
          console.log({ name });
          throw new Error("nope");
        },
      },
    },
    "@types": {
      node_modules: null,
      ":/typescript__.*/": null,
      // ":/node:.*/": null,
      [`:/${builtInNodeMods.join("|")}/`]: null,
      ":module/[a-z0-9-~][a-z0-9-._~]+/": {
        "**": ({ module, "**": path }) => {
          return load_file_sync(`https://unpkg.com/@types/${module}/${path}`);
        },
      },
    },
    "@typescript": {
      ":module/lib-*/": null,
    },
    // ":/node:.*/": null,
    [`:/${builtInNodeMods.join("|")}/`]: null,
    ":namespace/^@(.*)/": {
      ":module": {
        "**": ({ namespace, module, "**": path }) => {
          return load_file_sync(
            `https://unpkg.com/${namespace}/${module}/${path}`
          );
        },
      },
    },
    ":module/[a-z0-9-~][a-z0-9-._~]+/": {
      "**": ({ module, "**": path }) => {
        return load_file_sync(`https://unpkg.com/${module}/${path}`);
      },
    },
  },
};

let cool_console = console;

let initialize_vfs = async () => {
  let console = cool_console;
  // let console = {
  //   log: (...args) => {},
  //   group: (...args) => {},
  //   groupEnd: () => {},
  // };

  let directory = "../../../node_modules/typescript/lib/";
  // @ts-ignore
  const modules_not_loaded = import.meta.glob(
    "../../../node_modules/typescript/lib/*.d.ts",
    {
      as: "raw",
    }
  );
  console.log(`modules_not_loaded:`, modules_not_loaded);

  let modules = Object.fromEntries(
    await Promise.all(
      Object.entries(modules_not_loaded).map(async ([path, text_fn]) =>
        text_fn().then((text) => [path, text])
      )
    )
  );

  let filename = (k) => k.slice(directory.length);

  // ????? https://github.com/microsoft/TypeScript-Website/blob/v2/packages/typescript-vfs/src/index.ts#L101
  let module_names_to_load = [
    "lib.d.ts",
    "lib.es2015.d.ts",
    "lib.es2015.collection.d.ts",
    "lib.es2015.core.d.ts",
    "lib.es2015.generator.d.ts",
    "lib.es2015.iterable.d.ts",
    "lib.es2015.promise.d.ts",
    "lib.es2015.proxy.d.ts",
    "lib.es2015.reflect.d.ts",
    "lib.es2015.symbol.d.ts",
    "lib.es2015.symbol.wellknown.d.ts",
    "lib.es5.d.ts",
  ];

  let modules_to_load = mapKeys(
    pickBy(modules, (v, k) => module_names_to_load.includes(filename(k))),
    (v, k) => {
      return filename(k);
    }
  );

  // const fsMap = new Map();
  /** @type {Map<string, string>} */
  const fsMap = new Map();
  for (let [name, text] of Object.entries(modules)) {
    fsMap.set("/" + filename(name), text);
  }

  let compilerOptions = {
    allowJs: true,
    checkJs: true,
    // declarationDir: "declarations",
    // typeRoots: ["src/customTypings", "node_modules/@types"],
  };

  let system = createSystem(fsMap);

  let group = (name, fn) => {
    return (...args) => {
      console.group(name, "(", ...args, ")");
      try {
        let result = fn(...args);
        if (typeof result === "boolean" || result == null) {
          console.log("result:", result);
        } else {
          console.log("typeof result:", typeof result);
        }
        return result;
      } finally {
        console.groupEnd();
      }
    };
  };

  let better_system = {
    ...system,
    fileExists: group("fileExists", (path) => {
      if (system.fileExists(path)) {
        return true;
      }

      let tree_match = match(virtual_fs, path);
      if (tree_match) {
        let [result, params] = tree_match;

        if (typeof result === "object") {
          // This means it's a directory, which is, surprise, not a file!
          return false;
        } else if (typeof result === "function") {
          // Function means... a file!
          try {
            result(params);
            return true;
          } catch (e) {
            return false;
          }
        } else {
          console.log({ result });
          throw new Error("Huh");
        }
      } else {
        return false;
      }
    }),
    readDirectory: group("readDirectory", (path) => {
      throw new Error(`readDirectory("${path}")`);
    }),
    directoryExists: group("directoryExists", (path) => {
      let system_directoryExists = system.directoryExists(path);
      if (system_directoryExists === true) {
        return system_directoryExists;
      }

      let tree_match = match(virtual_fs, path);
      if (tree_match) {
        let [result, params] = tree_match;

        if (typeof result === "object") {
          // This means it's a directory, which is great!
          return true;
        } else if (typeof result === "function") {
          // Function means... a file!
          return false;
        } else {
          console.log({ result });
          throw new Error("Huh");
        }
      } else {
        return false;
      }
    }),

    readFile: group("readFile", (path) => {
      let existing_file = system.readFile(path);
      if (existing_file != null) {
        return existing_file;
      }

      let tree_match = match(virtual_fs, path);
      if (tree_match) {
        let [result, params] = tree_match;

        if (typeof result === "object") {
          return undefined;
        } else if (typeof result === "function") {
          // Function means... a file!
          return result(params);
        } else {
          console.log({ result });
          throw new Error("Huh");
        }
      }

      if (path === "/lib.d.ts") {
        console.log(`fsMap:`, fsMap.get("/lib.d.ts"));
      }
    }),
  };

  // @ts-ignore
  const env = createVirtualTypeScriptEnvironment(
    better_system,
    [],
    ts,
    compilerOptions
  );

  env.createFile(NOTEBOOK_FILE, ``);

  return env;
};

let env_promise = initialize_vfs();

let commands = {
  /** @param {{ code: string }} data */
  "update-notebook-file": async ({ code }) => {
    let env = await env_promise;

    try {
      env.updateFile(NOTEBOOK_FILE, code);
    } catch (error) {
      env.createFile(NOTEBOOK_FILE, code);
    }
  },
  /** @param {{ position: number }} data */
  "request-completions": async ({ position }) => {
    let env = await env_promise;

    let notebook_src = env.sys.readFile(NOTEBOOK_FILE) ?? "";
    // prettier-ignore
    console.log(`${notebook_src.slice(0, position)}|${notebook_src.slice(position)}`);

    let completions = env.languageService.getCompletionsAtPosition(
      NOTEBOOK_FILE,
      position,
      {},
      {}
    );
    return completions;
  },

  "request-info-at-position": async ({ position }) => {
    let env = await env_promise;
    return env.languageService.getQuickInfoAtPosition(NOTEBOOK_FILE, position);
  },

  "request-linting": async () => {
    let env = await env_promise;
    let syntactic_diagnostics =
      env.languageService.getSyntacticDiagnostics(NOTEBOOK_FILE);
    let semantic_diagnostic =
      env.languageService.getSemanticDiagnostics(NOTEBOOK_FILE);
    let suggestion_diagnostics =
      env.languageService.getSuggestionDiagnostics(NOTEBOOK_FILE);
    let result = [
      ...syntactic_diagnostics.map((x) => ({ ...x, kind: "syntactic" })),
      ...semantic_diagnostic.map((x) => ({ ...x, kind: "semantic" })),
      ...suggestion_diagnostics.map((x) => ({ ...x, kind: "suggestion" })),
    ];

    let SEVERITY = ["warning", "error", "info", "info"];
    let smooth_result = result.map(
      ({
        kind,
        code,
        messageText,
        relatedInformation,
        category,
        start = 0,
        length = Infinity,
      }) => {
        let end = start + length;
        return {
          kind,
          code,
          messageText,
          relatedInformation: relatedInformation?.map?.((x) => {
            return {
              category: x.category,
              code: x.code,
              messageText: x.messageText,
              start: x.start,
            };
          }),
          severity: SEVERITY[category],
          start,
          end,
          length,
        };
      }
    );
    return smooth_result;
  },
};

/**
 * @typedef _MessageObject
 * @type {{
 *  [P in keyof commands]?: { type: P, data: Parameters<commands[P]>[0] };
 * }}
 *
 * @typedef Message
 * @type {Exclude<_MessageObject[keyof _MessageObject], undefined>}
 */

/** @type {Array<{ id: string | null, job: () => Promise<unknown> }>} */
let _queue = [];
let is_running = false;
let run_next = () => {
  if (!is_running) {
    let job = _queue.shift();
    if (job) {
      is_running = true;
      job.job().then(() => {
        is_running = false;
        run_next();
      });
    }
  }
};
/**
 * @param {string | null} id
 * @param {() => Promise<unknown>} job
 */
let queue = async (id, job) => {
  // Remove job with the same id
  if (id != null) {
    _queue = _queue.filter((x) => x.id !== id);
  }

  _queue.push({ id, job });
  run_next();
};

/** @param {MessageEvent<{ request_id: unknown, job_id: string | null, request: Message }>} event */
self.onmessage = async (event) => {
  queue(event.data.job_id, async () => {
    console.group(event.data.request.type);
    try {
      console.log("Data from main thread:", event.data.request.data);
      let result = await commands[event.data.request.type](
        // @ts-ignore
        event.data.request.data
      );
      console.log("result:", result);
      postMessage({
        request_id: event.data.request_id,
        result,
      });
    } catch (error) {
      console.log(`error:`, error);
    } finally {
      console.groupEnd();
    }
  });
};
