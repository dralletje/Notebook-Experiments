import { parser } from "@lezer/lezer";
import dedent from "string-dedent";
import prettier from "prettier";
import fs from "fs/promises";

let result = prettier.format(
  await fs.readFile(
    new URL("./test.grammar", import.meta.url).pathname,
    "utf-8"
  ),
  {
    printWidth: 80,
    parser: "lezer",
    pluginSearchDirs: ["../"],
    plugins: ["@dral/prettier-plugin-lezer"],
  }
);

console.log(result);
