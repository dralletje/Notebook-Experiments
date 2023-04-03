import TOML from "@iarna/toml";
import { mapValues, merge, takeWhile } from "lodash-es";

import type { Cell, CellId, Notebook } from "../types.js";
import { Blueprint } from "./notebook-architect";
import { invariant } from "../leaf/invariant.js";

const OPEN = "// ╔═╡";
const BODY = "// ╠═╡";
const _cell_suffix = "\n\n";

let prefix_with_cool_markers = (string: string) => {
  return (
    string
      .split("\n")
      .map((line, index) => {
        if (index === 0) {
          return `${OPEN} ${line}`;
        } else {
          return `${BODY} ${line}`;
        }
      })
      .join("\n")
      .trim() + "\n"
  );
};

let format_toml_block = (data: any) => {
  let toml = TOML.stringify(data).trim();
  return prefix_with_cool_markers(toml);
};

// TODO Get a nice "Nice" heuristic for this
let get_markdown_cells_before = (notebook: Notebook, index: number) => {
  let result = [];
  while (index > 0) {
    index -= 1;
    let cell = notebook.cells[notebook.cell_order[index]];
    if (cell.type === "text") {
      result.push(cell);
    } else {
      break;
    }
  }
  return result;
};

let emit_code_cell = (cell: Cell & { type: "code" }) => {
  let result = "";
  result += format_toml_block({
    cells: {
      [cell.id]: {
        // @ts-ignore
        folded: cell.folded ?? false,
      },
    },
  });
  result += cell.code;
  result += _cell_suffix;
  return result;
};

let emit_markdown_cell = (cell: Cell & { type: "text" }) => {
  let result = "";
  result += format_toml_block({
    cells: {
      [cell.id]: {
        type: "text",
      },
    },
  });

  result += cell.code
    .split("\n")
    .map((line) => `// ${line}`)
    .join("\n");
  result += _cell_suffix;
  return result;
};

export let notebook_to_string = (notebook: Notebook, blueprint: Blueprint) => {
  let result = "";

  result += format_toml_block({
    DRAL_NOTEBOOK_VERSION: "0.0.1",
  });

  // Add empty `export {}` so my typescript knows it is a module
  result += "export {};\n\n";

  for (let cell_id of notebook.cell_order) {
    let cell = notebook.cells[cell_id];
    if (cell.type === "text") {
      result += emit_markdown_cell(cell as any);
    }
  }

  console.log(`blueprint:`, blueprint);

  for (let cell_id of blueprint.chambers.keys()) {
    let cell = notebook.cells[cell_id];
    // prettier-ignore
    invariant(cell.type === "code", `Cell "${cell_id} is not code, found in chambers`);
    result += emit_code_cell(cell as any);
  }

  for (let cell_id of blueprint.mistakes.keys()) {
    let cell = notebook.cells[cell_id];
    console.log(`cell:`, cell);
    // prettier-ignore
    invariant(cell.type === "code", `Cell "${cell_id} is not code, found in mistakes`);
    result += emit_code_cell(cell as any);
  }

  // This now sometimes prints it as inline (`"Cell Order": ["a", "b", "c"]`),
  // Maybe do this one custom to always print it as separate lines? idk
  result += format_toml_block({
    "Cell Order": {
      "Cell Order": notebook.cell_order,
    },
  });
  result += _cell_suffix;

  return result;
};

let uncomment = (string: string) => {
  return string.replace(/^\/\/( |$)/gm, "");
};

let un_body = (string: string) => {
  return string.replace(/^\/\/ ╠═╡ /gm, "");
};

export class NotNotebookError extends Error {}

export let notebook_from_string = (string: string): Notebook => {
  let blocks = string.split(`${OPEN} `).slice(1);
  let configs = [];

  for (let block of blocks) {
    let [header, ...lines] = block.split("\n");
    let meta_lines = takeWhile(lines, (line) => line.startsWith(BODY));
    let code = lines.slice(meta_lines.length).join("\n").trim();

    let config = TOML.parse(`${header}
${un_body(meta_lines.join("\n"))}
${TOML.stringify({ code })}
`);

    configs.push(config);
  }

  let config: {
    DRAL_NOTEBOOK_VERSION: string;
    cells: { [cell_id: CellId]: Cell };
    "Cell Order": { "Cell Order": CellId[] };
  } = merge({ cells: {} }, ...configs);

  if (config.DRAL_NOTEBOOK_VERSION == null) {
    throw new NotNotebookError();
  }

  // Make sure every cell in the cell order is actually in the notebook
  let cell_order = config["Cell Order"]["Cell Order"];
  for (let cell_id of cell_order) {
    if (config.cells[cell_id] == null) {
      // throw new Error(`Cell ${cell_id} is in the cell order but not in the notebook`);
      config.cells[cell_id] = {
        id: cell_id,
        code: "// This cell was in the cell order but not in the notebook",
        type: "code",
        folded: false,
        requested_run_time: 0,
      };
    }
  }

  // Make sure every cell in the notebook is actually in the cell order
  // TODO Place it in a little bit nice position close to where it wants to be?
  for (let cell_id of Object.keys(config.cells || {})) {
    if (!cell_order.includes(cell_id as CellId)) {
      cell_order.push(cell_id as CellId);
    }
  }

  return {
    cell_order: config["Cell Order"]["Cell Order"],
    cells: mapValues(config.cells, (cell, id) => {
      let type = cell.type ?? "code";
      let content = type === "text" ? uncomment(cell.code) : cell.code;
      return /** @type {Cell} */ {
        id: id as CellId,
        type: type,
        code: content,
        folded: cell.folded ?? false,
        requested_run_time: 0,
      };
    }),
  };
};
