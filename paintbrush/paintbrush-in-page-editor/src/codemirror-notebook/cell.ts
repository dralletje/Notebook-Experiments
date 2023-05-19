import { Annotation } from "@codemirror/state";
import { EditorId } from "codemirror-editor-in-chief";

export type CellId = EditorId;

export let NudgeCell = Annotation.define();

export type NotebookSerialized = {
  cells: { [key: CellId]: Cell };
  cell_order: CellId[];
};

export type Notebook = NotebookSerialized;

export type Cell = {
  id: CellId;
  type: "code" | "text";
  code: string;
  unsaved_code: string;
  requested_run_time: number;
  folded?: boolean;
};
