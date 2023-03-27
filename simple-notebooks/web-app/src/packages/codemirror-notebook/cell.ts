import { Facet, StateEffect, StateField } from "@codemirror/state";
import { Cell, CellId } from "./notebook-types";
import immer from "immer";
import { v4 as uuidv4 } from "uuid";

/**
 * So this should be split into two files:
 * 1. *React x Codemirror Xtreme*
 *    This is the file that allows using the React lifecycle as EditorView lifecycle.
 *    Could be part of Codemirror-x-React, but could also be on its own (and be a dependency of Codemirror-x-React ??)
 * 2. *Nested EditorStates/Cell EditorStates*
 *    This allows putting EditorStates inside of a parent EditorState, and make transactions and all
 *    work for it. This would be most that is currently in this file.
 */

export let empty_cell = (type: "code" | "text" = "code"): Cell => {
  return {
    id: uuidv4(),
    type: type,
    code: "",
    unsaved_code: "",
    last_run: -Infinity,
  };
};

type CellMeta = {
  code: string;
  last_run: number;
  is_waiting?: boolean;
  folded?: boolean;
  type?: "code" | "text";
};

export let MutateCellMetaEffect =
  StateEffect.define<(value: CellMeta) => void>();
export let CellMetaField = StateField.define<CellMeta>({
  create() {
    return {
      code: "",
      is_waiting: false,
      last_run: -Infinity,
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
});

export let CellTypeFacet = Facet.define<
  Exclude<Cell["type"], void>,
  Exclude<Cell["type"], void>
>({
  combine: (x) => x[0],
  // static: true,
});
