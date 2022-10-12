import { Facet } from "@codemirror/state";

export type EngineShadow = {
  cylinders: { [id: string]: CylinderShadow };
};

export type Result<T, E> =
  | {
      type: "return";
      name?: string;
      value: T;
    }
  | {
      type: "throw";
      value: E;
    }
  | {
      type: "pending";
    };

export type CylinderShadow = {
  last_run: number | null;
  result: Result<any, any> | null;
  running: boolean;
  waiting: boolean;
};

export type CellId = string;

export type NotebookSerialized = {
  id: string;
  cells: { [key: CellId]: Cell };
  cell_order: CellId[];
};

export type Notebook = NotebookSerialized;

export type Cell = {
  id: CellId;
  type: "code" | "text";
  code: string;
  unsaved_code: string;
  last_run: number;
  is_waiting?: boolean;
  folded?: boolean;
};

export let NotebookFilename = Facet.define<string, string>({
  combine: (a) => a[0],
});
export let NotebookId = Facet.define<string, string>({
  combine: (a) => a[0],
});
