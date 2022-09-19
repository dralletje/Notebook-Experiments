import {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualTypeScriptEnvironment,
} from "@typescript/vfs";
import { mapKeys, pickBy } from "lodash";
import ts from "typescript";

let _load_file_sync_cache = new Map();
console.log(`_load_file_sync_cache:`, _load_file_sync_cache);

let NOTEBOOK_FILE = "/notebook.ts";

let load_file_sync = (url) => {
  if (_load_file_sync_cache.has(url)) {
    return _load_file_sync_cache.get(url);
  }

  var request = new XMLHttpRequest();
  request.open("GET", url, false); // `false` makes the request synchronous
  request.timeout = 10 * 1000;
  request.send(null);

  if (request.status === 200) {
    console.log("LOADED FOR THE FIRST TIME", url);
    _load_file_sync_cache.set(url, request.responseText);
    return request.responseText;
  } else {
    _load_file_sync_cache.set(url, null);
    throw new Error(`failed to load ${url}`);
  }
};

let initialize_vfs = async () => {
  let directory = "../../../node_modules/typescript/lib/";
  // @ts-ignore
  const modules_not_loaded = import.meta.glob(
    "../../../node_modules/typescript/lib/*.d.ts",
    {
      as: "raw",
    }
  );

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
  // console.log(`fsMap:`, fsMap);

  let compilerOptions = {
    allowJs: true,
    checkJs: true,
    // declarationDir: "declarations",
    // typeRoots: ["src/customTypings", "node_modules/@types"],
  };

  let system = createSystem(fsMap);

  let better_system = {
    ...system,
    fileExists: (path) => {
      if (system.fileExists(path)) {
        return true;
      }

      let NODE_MODULES_DIR = "/node_modules/";
      if (path.startsWith(NODE_MODULES_DIR)) {
        let url_path = path.slice(NODE_MODULES_DIR.length);
        try {
          load_file_sync(`https://unpkg.com/${url_path}`);
          return true;
        } catch (error) {
          console.log("DOESNT EXIST", path);
          return false;
        }
      }

      console.log("NOPE", path);

      return false;
    },
    readDirectory: (path) => {
      let x = system.readDirectory(path);
      console.log(`readDirectory:`, path, x);
      return x;
    },
    directoryExists: (path) => {
      if (path.startsWith("/node_modules/@typescript")) {
        // return false;
        console.log(`path:`, path);
      }

      // if (path === "node_modules/@types") {
      //   return true;
      // }
      if (path === "/node_modules") {
        return true;
      }
      if (path.startsWith("/node_modules/")) {
        return true;
      }
      let x = system.directoryExists(path);
      console.log(`directoryExists:`, path, x);
      return x;
    },

    readFile: (fileName) => {
      let existing_file = system.readFile(fileName);
      if (existing_file != null) {
        return existing_file;
      }

      let NODE_MODULES_DIR = "/node_modules/";
      if (fileName.startsWith(NODE_MODULES_DIR)) {
        let path = fileName.slice(NODE_MODULES_DIR.length);
        try {
          let text = load_file_sync(`https://unpkg.com/${path}`);
          return text;
        } catch (error) {
          console.log("BAD", error, path);
          return null;
        }
      }

      console.log("FILE NOT FOUND", fileName);
    },
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

/**
 * @typedef MyMessages
 * @type {
 *  | { type: "update-notebook-file", code: string }
 *  | { type: "get-me-completions", position: number }
 * }
 */

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
    console.log(
      `${notebook_src.slice(0, position)}|${notebook_src.slice(position)}`
    );

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
          relatedInformation,
          severity: SEVERITY[category],
          start,
          end,
          length,
        };
      }
    );
    console.log(`result:`, smooth_result);
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

/** @param {MessageEvent<{ request_id: unknown, request: Message }>} event */
self.onmessage = async (event) => {
  console.group(event.data.request.type);
  try {
    console.log("Data from main thread:", event.data.request.data);
    let result = await commands[event.data.request.type](
      // @ts-ignore
      event.data.request.data
    );
    console.log("Result:", result);
    postMessage({
      request_id: event.data.request_id,
      result,
    });
  } catch (error) {
    console.log(`error:`, error);
  } finally {
    console.groupEnd();
  }
};
