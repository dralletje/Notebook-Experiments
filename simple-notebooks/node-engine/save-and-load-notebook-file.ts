import {
  notebook_from_string,
  notebook_to_string,
  Notebook,
} from "@dral/javascript-notebook-runner";
import { ParsedCells } from "@dral/javascript-notebook-runner/dist/parts/parse-cache";
import fs from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";

export let save_notebook = async (
  notebook: { filename: string; notebook: Notebook },
  parsed: ParsedCells,
  directory: string
) => {
  let content = notebook_to_string(notebook.notebook, parsed);
  console.log("SAVING!");
  if (content.trim() === "") {
    console.log({ notebook: notebook.notebook, parsed });
    throw new Error("Empty notebook");
  }
  await writeFileAtomic(`${directory}/${notebook.filename}`, content);
  console.log("DONE SAVING");
};

export let load_notebook = async (directory: string, filename: string) => {
  let content = await fs.readFile(`${directory}/${filename}`);
  let notebook = notebook_from_string(content.toString());
  return { filename, notebook };
};
