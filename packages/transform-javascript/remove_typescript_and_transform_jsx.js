import { transformSync } from "@babel/core";
import preset from "@babel/preset-typescript";
import preset_react from "@babel/preset-react";

import { clean_error } from "./babel-helpers.js";

/**
 * @param {string} code
 * @returns {string}
 */
export let remove_typescript_and_transform_jsx = (code) => {
  try {
    let without_typescript = transformSync(code, {
      filename: "file.ts",
      sourceRoot: "/",
      root: "/",

      parserOpts: {
        allowUndeclaredExports: true,
        allowReturnOutsideFunction: true,
      },
      presets: [
        [
          preset,
          { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true },
        ],
        [
          preset_react,
          {
            runtime: "classic",
          },
        ],
      ],
    });
    return /** @type {any} */ (without_typescript?.code);
  } catch (error) {
    throw clean_error(error);
  }
};
