import { NodePath } from "@babel/traverse";
import traverse1 from "@babel/traverse";
import { parse as parseBabel } from "@babel/parser";
import strip_colors from "strip-color";

/** @type {typeof traverse1} */
export let traverse = /** @type {any} */ (traverse1).default ?? traverse1;

/**
 * @typedef AST
 * @type {ReturnType<parseBabel>}
 */

export let clean_error = (error) => {
  if (error instanceof SyntaxError) {
    let new_error = new SyntaxError(strip_colors(error.message));
    new_error.stack = "";
    return new_error;
  } else {
    return error;
  }
};

/**
 * @param {import("@babel/types").File} ast
 * @return {NodePath["scope"]}
 */
export let get_scope = (ast) => {
  /** @type {NodePath<any>} */
  let program_path = /** @type {any} */ (null);
  traverse(ast, {
    Program(path) {
      program_path = path;
    },
  });
  let scope = program_path.scope;
  return scope;
};
