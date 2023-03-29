// So I used to

import * as types from "@babel/types";
import { clean_error, traverse } from "./babel-helpers.js";

import _remove_typescript_plugin from "@babel/plugin-transform-typescript";
import _transform_react from "@babel/plugin-transform-react-jsx";

/** @type {typeof _remove_typescript_plugin} */
// prettier-ignore
let remove_typescript_plugin = _remove_typescript_plugin.default ?? _remove_typescript_plugin;

/** @type {typeof _remove_typescript_plugin} */
// prettier-ignore
let transform_react = _transform_react.default ?? _transform_react;

class PluginPass {
  /**
   * @param {import("@babel/types").File} ast
   */
  constructor(ast) {
    this.file = { ast };
  }

  _map = new Map();

  set(key, val) {
    this._map.set(key, val);
  }
  get(key) {
    return this._map.get(key);
  }
}

/**
 * Because babel-core is a mess, and the whole transform and preset
 * stuff is very filesystem based... I can't get it to work in the browser...
 * So I'm doing the transforms by calling the plugins manually.
 *
 * @param {import("@babel/types").File} ast
 * @returns {import("@babel/types").File} ast
 */
export let remove_typescript_and_transform_jsx = (ast) => {
  let api = {
    assertVersion: () => {},
    types: types,
  };
  let what = remove_typescript_plugin(
    api,
    {
      allowDeclareFields: true,
      // jsxPragma = "React.createElement",
      // jsxPragmaFrag = "React.Fragment",
      onlyRemoveTypeImports: true,
      // optimizeConstEnums = false
    },
    ""
  );

  let react = transform_react(api, {}, "");

  let pass = /** @type {any} */ (new PluginPass(ast));
  traverse(ast, react.visitor, undefined, pass);
  traverse(ast, what.visitor, undefined, pass);

  // Recompute scope, as the react transform might add `React` as a usage
  traverse(ast, {
    Program: (path) => {
      path.scope.crawl();
    },
  });

  return ast;
};
