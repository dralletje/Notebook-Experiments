// import { parse, prettyPrint, print } from "recast";
import { parseSync as parseSWC, printSync, transformSync } from "../swc";

// import { remove_typescript_and_transform_jsx } from "./remove_typescript_and_transform_jsx";
import { transform } from "./transform";

export function transform_code(
  code: string,
  { filename }: { filename: string }
) {
  console.log("#1");
  // let unmodified_ast = parse(code, {
  //   parser: {
  //     parse: (input, options) => {
  //       return parseBabel(input, {
  //         allowUndeclaredExports: true,
  //         allowReturnOutsideFunction: true,
  //         startLine: 1,
  //         // So it really needs `tokens: true` to support jsx and that took me way too long to figure out
  //         tokens: true,
  //         plugins: [
  //           "jsx",
  //           "doExpressions",
  //           [
  //             "typescript",
  //             {
  //               // @ts-expect-error yes typescript, isTSX exists!!
  //               isTSX: true,
  //             },
  //           ],
  //         ],
  //         sourceType: "module",
  //       });
  //     },
  //   },
  //   tabWidth: 2,
  //   // useTabs: true,
  //   sourceFileName: filename,
  // });

  let unmodified_ast = parseSWC(code, {
    syntax: "typescript",
    script: false,
    target: "es2022",
    tsx: true,
  });

  console.log(`#3:`, unmodified_ast);

  // let without_typescript = remove_typescript_and_transform_jsx(unmodified_ast);

  let {
    ast,
    meta: {
      consumed_names,
      created_names,
      last_created_name,
      has_top_level_return,
    },
  } = transform(structuredClone(unmodified_ast));

  console.log(`ast:`, ast);

  let result = printSync(ast, {
    // sourceMaps: true,
  });

  console.log(`result:`, result.code);
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
