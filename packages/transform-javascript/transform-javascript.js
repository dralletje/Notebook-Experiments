import { parse, prettyPrint, print } from "recast";
import { parse as parseBabel } from "@babel/parser";

import { remove_typescript_and_transform_jsx } from "./remove_typescript_and_transform_jsx.js";
import { transform } from "./transform.js";

let btoa =
  globalThis.btoa ??
  ((string) => {
    let buff = Buffer.from(string);
    return buff.toString("base64");
  });

/**
 * @param {string} code
 * @param {{ filename: string }} options
 */
export function transform_code(code, { filename }) {
  /** @type {import("@babel/parser").ParseResult<import("@babel/types").File>} */
  let unmodified_ast = parse(code, {
    parser: {
      parse: (input, options) => {
        return parseBabel(input, {
          allowUndeclaredExports: true,
          allowReturnOutsideFunction: true,
          startLine: 1,
          // So it really needs `tokens: true` to support jsx and that took me way too long to figure out
          tokens: true,
          plugins: [
            "jsx",
            [
              "typescript",
              {
                // @ts-expect-error yes typescript, isTSX exists!!
                isTSX: true,
              },
            ],
          ],
          sourceType: "module",
        });
      },
    },
    tabWidth: 2,
    // useTabs: true,
    sourceFileName: filename,
  });

  let without_typescript = remove_typescript_and_transform_jsx(unmodified_ast);

  let {
    ast,
    meta: {
      consumed_names,
      created_names,
      last_created_name,
      has_top_level_return,
    },
  } = transform(without_typescript);

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
    // tabWidth: 0,
    sourceMapName: "map.json",
  });
  // let result = print(ast, {});

  // let source_map = "data:text/plain;base64," + btoa(JSON.stringify(result.map));
  // let full_code = `${result.code}\n//# sourceMappingURL=${source_map}\n//# sourceURL=${filename}`;
  let full_code = result.code;

  return {
    // map: result.map,
    map: null,
    code: full_code,
    meta: {
      created_names,
      consumed_names,
      last_created_name,
      has_top_level_return,
    },
  };
}
