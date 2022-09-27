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
};

export type CellId = string;

export type Notebook = {
  id: string;
  cells: { [key: CellId]: Cell };
  cell_order: CellId[];
};

export type Cell = {
  id: CellId;
  type?: "code" | "text";
  code: string;
  unsaved_code: string;
  last_run: number;
  is_waiting?: boolean;
  folded?: boolean;
};
