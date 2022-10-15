import { parse, prettyPrint } from "recast";
import { builders } from "ast-types";
import { parse as parseBabel } from "@babel/parser";

import { remove_typescript_and_transform_jsx } from "./remove_typescript_and_transform_jsx.js";
import { transform } from "./transform.js";

let t = builders;

let btoa = (string) => {
  let buff = Buffer.from(string);
  return buff.toString("base64");
};

/**
 * @param {string} code
 * @param {{ filename: string }} options
 */
export function transform_code(code, { filename }) {
  let without_typescript = remove_typescript_and_transform_jsx(code);

  /** @type {ReturnType<parseBabel>} */
  let unmodified_ast = parse(without_typescript, {
    parser: {
      parse: (input, options) => {
        return parseBabel(input, {
          ...options,
          plugins: ["typescript", "jsx"],
          allowUndeclaredExports: true,
          allowReturnOutsideFunction: true,
        });
      },
    },
    // tabWidth: 0,
    sourceFileName: filename,
  });

  let {
    ast,
    meta: {
      consumed_names,
      created_names,
      last_created_name,
      has_top_level_return,
    },
  } = transform(unmodified_ast);

  // TODO Want to use print() here, but it screws up template strings:
  // .... `
  // .... hi
  // .... `
  // .... becomes
  // ....     `
  // ....     hi
  // ....     `
  // .... which is very wrong
  let result = prettyPrint(ast, {
    tabWidth: 0,
    sourceMapName: "map.json",
  });

  // let source_map = "data:text/plain;base64," + btoa(JSON.stringify(result.map));
  // let full_code = `${result.code}\n//# sourceMappingURL=${source_map}\n//# sourceURL=${filename}`;
  let full_code = result.code;
  return {
    map: result.map,
    code: full_code,
    meta: {
      created_names,
      consumed_names,
      last_created_name,
      has_top_level_return,
    },
  };
}
