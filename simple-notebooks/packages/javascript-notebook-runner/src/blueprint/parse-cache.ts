import { transform_code } from "@dral/dralbook-transform-javascript";
import { ModernMap } from "@dral/modern-map";
import { EdgeName } from "../leaf/graph";

type Code = string;
export type ParsedCells = { [key: string]: ParsedCell | null };
export type Reference = { in: EdgeName; out: EdgeName };

export type ParsedCell =
  | Readonly<{
      input: Code;
      output: {
        code: Code;
        map: any;
        meta: Readonly<{
          input: Reference[];
          output: Reference[];
          last_created_name?: string;
          has_top_level_return: boolean;
        }>;
      };
    }>
  | Readonly<{
      input: string;
      error: Error;
    }>
  | Readonly<{
      input: string;
      static: any;
    }>;

type InputCell = {
  id: string;
  code: string;
};

type ParseMeta = {
  consumed_names: string[];
  created_names: string[];

  last_created_name?: string;
  has_top_level_return: boolean;
};

let parse_cell_not_memo = (cell: InputCell): ParsedCell => {
  try {
    let { code, meta, map } = transform_code(cell.code, {
      filename: `${cell.id}.js`,
    }) as { code: string; meta: ParseMeta; map: unknown };
    return {
      input: cell.code,
      output: {
        code,
        map,
        meta: {
          input: meta.consumed_names.map((x) => ({
            in: x as EdgeName,
            out: x as EdgeName,
          })),
          output: meta.created_names.map((x) => ({
            in: x as EdgeName,
            out: x as EdgeName,
          })),
          last_created_name: meta.last_created_name,
          has_top_level_return: meta.has_top_level_return,
        },
      },
    };
  } catch (error) {
    if (error.code === "BABEL_PARSER_SYNTAX_ERROR") {
      error.message = `${error.message} at ${error.loc.line}:${error.loc.column}`;
    }

    return {
      input: cell.code,
      error: error,
    };
  }
};

export class ParseCache {
  private cache: ModernMap<string, ParsedCell> = new ModernMap();

  parse(cell: InputCell): ParsedCell {
    return this.cache.emplace(cell.id, {
      insert: (key) => parse_cell_not_memo(cell),
      update: (value, key, map) =>
        value.input === cell.code ? value : parse_cell_not_memo(cell),
    });
  }

  parse_notebook(notebook: { [key: string]: InputCell }): ParsedCells {
    for (let [id, input_cell] of Object.entries(notebook)) {
      this.parse(input_cell);
    }
    for (let key of this.cache.keys()) {
      if (!(key in notebook)) {
        this.cache.delete(key);
      }
    }
    return Object.fromEntries(this.cache);
  }
}
