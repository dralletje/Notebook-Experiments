import chalk from "chalk";
import { Cell } from "./node-engine";

import { transform_code } from "run-javascript";

type ParsedCell =
  | {
      input: string;
      output: {
        code: string;
        consumed_names: string[];
        created_names: string[];
        last_created_name?: string;
        map: any;
      };
    }
  | {
      input: string;
      error: Error;
    };

let parse_cell_not_memo = (cell: Cell): ParsedCell => {
  try {
    let { code, consumed_names, created_names, last_created_name, map } =
      transform_code(cell.code, {
        filename: `${cell.id}.js`,
      });
    return {
      input: cell.code,
      output: {
        code,
        map,
        consumed_names,
        created_names,
        last_created_name,
      },
    };
  } catch (error) {
    console.log(chalk.red.bold`ERROR PARSING:`, chalk.red(error.stack));
    console.log(chalk.bold.red(cell.code));

    if (error.code === "BABEL_PARSER_SYNTAX_ERROR") {
      error.message = `${error.message} at ${error.loc.line}:${error.loc.column}`;
    }

    return {
      input: cell.code,
      error: error,
    };
  }
};

let parsed_cell_weakmap = new WeakMap<Cell, ParsedCell>();
export let parse_cell = (cell: Cell) => {
  let cached = parsed_cell_weakmap.get(cell);
  if (cached != null && cached.input === cell.code) {
    return cached;
  }

  let parsed = parse_cell_not_memo(cell);
  parsed_cell_weakmap.set(cell, parsed);

  return parsed;
};
