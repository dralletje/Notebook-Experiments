import { invertedEffects } from "@codemirror/commands";
import { Annotation, Facet, StateEffect, StateField } from "@codemirror/state";
import immer from "immer";
import { v4 as uuidv4 } from "uuid";
import { EditorId } from "../codemirror-editor-in-chief/logic";

export type CellId = EditorId;

export let empty_cell = (type: "code" | "text" = "code"): Cell => {
  return {
    id: uuidv4(),
    type: type,
    code: "",
    unsaved_code: "",
    requested_run_time: 0,
  };
};

export let NudgeCell = Annotation.define();

type CellMeta = {
  code: string;
  requested_run_time: number;
  folded?: boolean;
  type: "code" | "text";
};

export let MutateCellMetaEffect =
  StateEffect.define<(value: CellMeta) => void>();

let invert_fold = invertedEffects.of((tr) => {
  let was = tr.startState.field(CellMetaField).folded;
  let is = tr.state.field(CellMetaField).folded;
  if (was !== is) {
    return [
      MutateCellMetaEffect.of((meta) => {
        meta.folded = was;
      }),
    ];
  } else {
    return [];
  }
});

export let CellMetaField = StateField.define<CellMeta>({
  create() {
    return {
      code: "",
      requested_run_time: 0,
      folded: false,
      type: "code",
    };
  },
  update(value, transaction) {
    return immer(value, (value) => {
      for (let effect of transaction.effects) {
        if (effect.is(MutateCellMetaEffect)) {
          effect.value(value);
        }
      }
    });
  },
  provide: () => invert_fold,
});

export let CellTypeFacet = Facet.define<
  Exclude<Cell["type"], void>,
  Exclude<Cell["type"], void>
>({
  combine: (x) => x[0],
  // static: true,
});

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
  requested_run_time: number;
  folded?: boolean;
};

export let NotebookFilename = Facet.define<string, string>({
  combine: (a) => a[0],
});
export let NotebookId = Facet.define<string, string>({
  combine: (a) => a[0],
});

export type Log = {
  id: string;
  cell_id?: CellId;
  title: string;
  body: string;
};

export type EngineShadow = {
  cylinders: { [id: string]: CylinderShadow };
};
export type CylinderShadow = {
  last_run: number;
  result: Result<any, any> | null;
  running: boolean;
  waiting: boolean;

  // TODO Rename this to something not called "internal"
  last_internal_run: number;
};
export type Result<T, E> =
  | { type: "return"; name?: string; value: T }
  | { type: "throw"; value: E }
  | { type: "pending" };
