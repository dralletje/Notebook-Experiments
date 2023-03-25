import {
  Compartment,
  EditorState,
  Extension,
  Facet,
  StateEffect,
  StateField,
  Transaction,
  TransactionSpec,
  StateEffectType,
} from "@codemirror/state";
import { Cell, CellId } from "./notebook-types";
import immer from "immer";
import { compact, takeWhile, zip, remove, without } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { NestedEditorStatesField } from "./packages/codemirror-nexus2/MultiEditor";

/**
 * So this should be split into two files:
 * 1. *React x Codemirror Xtreme*
 *    This is the file that allows using the React lifecycle as EditorView lifecycle.
 *    Could be part of Codemirror-x-React, but could also be on its own (and be a dependency of Codemirror-x-React ??)
 * 2. *Nested EditorStates/Cell EditorStates*
 *    This allows putting EditorStates inside of a parent EditorState, and make transactions and all
 *    work for it. This would be most that is currently in this file.
 */

export type NotebookState = EditorState;

export let RunCellEffect = StateEffect.define<{
  cell_id: CellId;
  at: number;
}>();

export let RunIfChangedCellEffect = StateEffect.define<{
  cell_id: CellId;
  at: number;
}>();

export let CellIdFacet = Facet.define<string, string>({
  combine: (x) => x[0],
});

type StateEffectFromType<Type> = Type extends StateEffectType<infer X>
  ? StateEffect<X>
  : never;

export let cell_dispatch_effect_effects = (
  effect: StateEffectFromType<typeof CellDispatchEffect>
) => {
  let effects = effect.value.transaction.effects;
  if (Array.isArray(effects)) {
    return effects;
  } else if (effects == null) {
    return [];
  } else {
    return [effects];
  }
};

// export let cellTransactionForTransaction =
//   Facet.define<
//     (
//       transaction: Transaction,
//       cell_state: EditorState
//     ) => TransactionSpec | null
//   >();

export let FromCellTransactionEffect = StateEffect.define<{
  cell_id: CellId;
  transaction: Transaction;
}>();

export let CellDispatchEffect = StateEffect.define<{
  cell_id: CellId;
  transaction: TransactionSpec | Transaction;
}>();

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
  static: true,
});

export let CellHasSelectionEffect = StateEffect.define<boolean>();
export let CellHasSelectionField = StateField.define<boolean>({
  create() {
    return false;
  },
  update(value, transaction) {
    for (let effect of transaction.effects) {
      if (effect.is(CellHasSelectionEffect)) {
        value = effect.value;
      }
    }
    return value;
  },
});

let add_single_cell_when_all_cells_are_removed =
  EditorState.transactionExtender.of((transaction) => {
    let notebook = transaction.startState.field(CellEditorStatesField);
    let cells_left_after_effects = new Set(notebook.cell_order);
    for (let effect of transaction.effects) {
      if (effect.is(AddCellEffect)) {
        cells_left_after_effects.add(effect.value.cell.id);
      }
      if (effect.is(AddCellEditorStateEffect)) {
        cells_left_after_effects.add(
          effect.value.cell_editor_state.facet(CellIdFacet)
        );
      }
      if (effect.is(RemoveCellEffect)) {
        cells_left_after_effects.delete(effect.value.cell_id);
      }
    }

    // Add a cell when the last cell is removed
    if (cells_left_after_effects.size === 0) {
      return {
        effects: AddCellEffect.of({
          index: 0,
          cell: empty_cell(),
        }),
      };
    } else {
      return null;
    }
  });

export let BlurAllCells = StateEffect.define<void>();
