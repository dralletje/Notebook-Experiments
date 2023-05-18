import { invertedEffects } from "@codemirror/commands";
import { Annotation, Facet, StateEffect, StateField } from "@codemirror/state";
import { produce as immer } from "immer";
import { v4 as uuidv4 } from "uuid";
import { EditorId } from "../codemirror-editor-in-chief/logic";

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
