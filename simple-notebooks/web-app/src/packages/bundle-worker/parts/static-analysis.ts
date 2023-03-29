import { ParsedCell } from "../leaf/parse-cell";
import { CellId, Notebook } from "../types";
import { ExecutionResult } from "./notebook-step";

export type StaticAnalysis = {
  cells_to_run: CellId[];
  static_results: { [key: CellId]: ExecutionResult };
};

export let analyse_notebook = (
  notebook: Notebook,
  parsed_cells: { [key: string]: ParsedCell }
): StaticAnalysis => {
  throw new Error("implement me");
};
