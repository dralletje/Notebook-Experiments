import chalk from "chalk";
import { transform_code } from "@dral/dralbook-transform-javascript";

export type ParsedCell =
  | Readonly<{
      input: string;
      output: {
        code: string;
        map: any;
        meta: Readonly<{
          input: string[];
          output: string[];
          last_created_name?: string;
          has_top_level_return: boolean;
        }>;
      };
    }>
  | Readonly<{
      input: string;
      error: Error;
    }>;

type InputCell = {
  id: unknown;
  code: string;
};

let parse_cell_not_memo = (cell: InputCell): ParsedCell => {
  try {
    let { code, meta, map } = transform_code(cell.code, {
      filename: `${cell.id}.js`,
    });
    return {
      input: cell.code,
      output: {
        code,
        map,
        meta: {
          input: meta.consumed_names,
          output: meta.created_names,
          last_created_name: meta.last_created_name,
          has_top_level_return: meta.has_top_level_return,
        },
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

let parsed_cell_weakmap = new WeakMap<InputCell, ParsedCell>();
export let parse_cell = (cell: InputCell) => {
  let cached = parsed_cell_weakmap.get(cell);
  if (cached != null && cached.input === cell.code) {
    return cached;
  }

  let parsed = parse_cell_not_memo(cell);
  parsed_cell_weakmap.set(cell, parsed);

  return parsed;
};
