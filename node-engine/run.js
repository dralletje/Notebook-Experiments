import vm from "vm";
import serialize from "./serialize.js";
import Module from "module";

const filename = "eval.js";

const contexts = {};

function getContext(ctxId) {
  if (ctxId && contexts[ctxId]) {
    return contexts[ctxId];
  }

  const mod = new Module(filename, null);
  mod.id = ".";
  mod.filename = filename;

  const sandbox = {
    module: mod,
    require: mod.require.bind(mod),
  };

  const ctx = vm.createContext(sandbox);

  Object.defineProperties(ctx, {
    global: {
      ...Object.getOwnPropertyDescriptor(global, "global"),
      value: ctx,
    },
  });

  contexts[ctxId] = ctx;
  return ctx;
}

function runInContext(code, context) {
  const script = vm.createScript(code, {
    filename,
  });
  const result = script.runInContext(context);

  return result;
}

const globalScript = vm.createScript("global");

export default function run(code, ctxId) {
  if (code[0] === "{" && code[code.length - 1] === "}") {
    code = `(${code})`;
  }

  // we can turn this into a repl by caching the context
  // per session and re-using it for subsequent evals!
  const context = getContext(ctxId);
  const result = runInContext(code, context);

  return serialize(result, globalScript.runInContext(context));
}
