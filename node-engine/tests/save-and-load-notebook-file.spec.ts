import chalk from "chalk";
import { isEqual } from "lodash-es";
import {
  notebook_to_string,
  notebook_from_string,
} from "../save-and-load-notebook-file.js";
import { assert, it } from "./test-framework.js";

it("save and load notebook file", async () => {
  let notebook = {
    cell_order: ["3", "1", "2"],
    cells: {
      "1": {
        id: "1",
        type: "code" as const,
        last_run: 0,
        code: "let x = 1;",
      },
      "3": {
        id: "3",
        type: "text" as const,
        last_run: 0,
        code: "# My notebook",
      },
      "2": {
        id: "2",
        type: "code" as const,
        last_run: 0,
        code: "let y = 2;",
      },
    },
  };

  let saved = await notebook_to_string(notebook);
  console.log(chalk.blue(saved));
  let from_string = notebook_from_string(saved);
  try {
    assert(isEqual(notebook, from_string));
  } catch (error) {
    console.log(chalk.red("notebook:"));
    console.log(notebook);
    console.log(chalk.red("from_string:"));
    console.log(from_string);
    throw error;
  }
});
