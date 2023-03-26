import {
  EditorState,
  Extension,
  Facet,
  StateEffect,
  StateField,
  Transaction,
  TransactionSpec,
  StateEffectType,
  EditorStateConfig,
} from "@codemirror/state";
import immer from "immer";
import { GenericViewUpdate } from "codemirror-x-react/viewupdate.js";
import { invertedEffects } from "@codemirror/commands";
import { EditorInChief } from "./editor-in-chief";

type EditorId = string;

export let EditorIdFacet = Facet.define<EditorId, EditorId>({
  combine: (x) => x[0],
});

export let NestedExtension = Facet.define<Extension>({ static: true });

type StateEffectFromType<Type> = Type extends StateEffectType<infer X>
  ? StateEffect<X>
  : never;

export let cell_dispatch_effect_effects = (
  effect: StateEffectFromType<typeof EditorDispatchEffect>
): StateEffect<any>[] => {
  let effects = effect.value.transaction.effects;
  if (Array.isArray(effects)) {
    return effects;
  } else if (effects == null) {
    return [];
  } else {
    // @ts-ignore
    return [effects];
  }
};

export let expand_cell_effects_that_are_actually_meant_for_the_nexus =
  EditorState.transactionExtender.of((transaction) => {
    let moar_effects: Array<StateEffect<any>> = [];
    for (let effect of transaction.effects) {
      if (effect.is(EditorDispatchEffect)) {
        for (let cell_effect of cell_dispatch_effect_effects(effect)) {
          if (cell_effect.is(EditorInChiefEffect)) {
            let effects =
              typeof cell_effect.value === "function"
                ? cell_effect.value(new EditorInChief(transaction.state))
                : cell_effect.value;
            if (Array.isArray(effects)) {
              moar_effects.push(...effects);
            } else {
              moar_effects.push(effects);
            }
          }
        }
      }
    }

    if (moar_effects.length > 0) {
      return { effects: moar_effects };
    }
    return null;
  });

// export let cellTransactionForTransaction =
//   Facet.define<
//     (
//       transaction: Transaction,
//       cell_state: EditorState
//     ) => TransactionSpec | null
//   >();

/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
import { EditorView, ViewPlugin } from "@codemirror/view";
import React from "react";

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

let CellHasSelectionPlugin = [
  EditorView.editorAttributes.of((view) => {
    let has_selection = view.state.field(CellHasSelectionField);
    return { class: has_selection ? "has-selection" : "" };
  }),
  ViewPlugin.define((view) => {
    let has_selection = view.state.field(CellHasSelectionField);
    if (has_selection === true) {
      Promise.resolve().then(() => {
        // Make sure the editor isn't removed yet :O
        if (view.dom.isConnected) {
          view.focus();
        }
      });
    }

    return {
      update: (update) => {
        let had_selection = update.startState.field(CellHasSelectionField);
        let needs_selection = update.state.field(CellHasSelectionField);
        if (had_selection !== needs_selection) {
          let has_focus = view.dom.contains(document.activeElement);
          if (has_focus === needs_selection) return;

          if (needs_selection) {
            try {
              // TODO Somehow this crashes when the backspace-merge-with-previous-cell happens...
              // .... Yet.. it works fine ?!
              update.view.focus();
            } catch (e) {}
          } else {
            update.view.dom.blur();
          }
        }
      },
    };
  }),
  EditorView.theme({
    "&:not(.has-selection) .cm-selectionBackground": {
      // Need to figure out what precedence I should give this thing so I don't need !important
      background: "none !important",
    },
  }),
];
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////

export let create_nested_editor_state = ({
  parent,
  cell_id,
  doc,
  extensions,
  selection,
}: {
  parent: EditorState;
  cell_id: EditorId;

  doc?: EditorStateConfig["doc"];
  extensions?: EditorStateConfig["extensions"];
  selection?: EditorStateConfig["selection"];
}) => {
  return EditorState.create({
    doc: doc,
    selection: selection,
    extensions: [
      EditorIdFacet.of(cell_id),
      CellHasSelectionField,
      CellHasSelectionPlugin,
      parent.facet(NestedExtension) ?? [],
      extensions ?? [],
    ],
  });
};

export let BlurAllCells = StateEffect.define<void>();

export let EditorDispatchEffect = StateEffect.define<{
  cell_id: EditorId;
  transaction: TransactionSpec | Transaction;
}>();

export let EditorInChiefEffect = StateEffect.define<
  | ((state: EditorInChief) => StateEffect<any>[] | StateEffect<any>)
  | StateEffect<any>[]
  | StateEffect<any>
>();

export let CellAddEffect = StateEffect.define<{
  cell_id: EditorId;
  state: EditorState;
}>();
export let CellRemoveEffect = StateEffect.define<{
  cell_id: EditorId;
}>();

export let NestedEditorStatesField = StateField.define<{
  cells: { [key: EditorId]: EditorState };
  /** So... I need this separate from the EditorState's selection,
   *  because EditorState.selection can't be empty/inactive
   *  ALSO: Screw multiple selections (for now) */
  cell_with_current_selection: EditorId | null;

  /** Necessary because the cells views need to be updated with the transactions */
  transactions_to_send_to_cells: Array<Transaction>;
}>({
  create() {
    return {
      cells: {},
      cell_with_current_selection: null,

      transactions_to_send_to_cells: [],
    };
  },
  update(state, transaction) {
    try {
      let initial_state = state;
      return immer(state, (state) => {
        state.transactions_to_send_to_cells = [];
        let {
          cells: _cells,
          transactions_to_send_to_cells: _transactions_to_send_to_cells,
        } = state;

        // Tell typescript it doesn't need to care about WritableDraft >_>
        let cells = _cells as any as { [key: EditorId]: EditorState };
        let transactions_to_send_to_cells =
          _transactions_to_send_to_cells as any as Array<Transaction>;

        if (
          transaction.startState.facet(NestedExtension) !==
          transaction.state.facet(NestedExtension)
        ) {
          // prettier-ignore
          throw new Error(`Please don't change the NestedExtension facet yet... please`);
        }

        for (let effect of transaction.effects) {
          if (effect.is(EditorDispatchEffect)) {
            let { cell_id, transaction: spec } = effect.value;
            let cell_state = cells[cell_id];

            if (cell_state == null) {
              // prettier-ignore
              console.log(`⚠ EditorDispatchEffect for Cell(${cell_id}) but no cell state exists`, { effect });
              continue;
            }

            let transaction = cell_state.update(spec);
            transactions_to_send_to_cells.push(transaction);
            cells[cell_id] = transaction.state;

            if (transaction.selection != null) {
              state.cell_with_current_selection =
                transaction.startState.facet(EditorIdFacet);
            }
          }

          if (effect.is(CellAddEffect)) {
            let { cell_id, state: cell_state } = effect.value;
            cells[cell_id] = cell_state;
          }

          if (effect.is(CellRemoveEffect)) {
            let { cell_id } = effect.value;
            delete cells[cell_id];
          }
        }

        // "Hack" to make BlurAllCells work
        // TODO Ideally we do this "together" with the other effects,
        // .... because in an edge case there might be an explicit selection
        // .... "after" the BlurAllCells effect, and we'd want to respect that
        for (let effect of transaction.effects) {
          if (effect.is(BlurAllCells)) {
            state.cell_with_current_selection = null;
          }
        }

        for (let [cell_id, cell] of Object.entries(cells)) {
          if (state.cell_with_current_selection === cell_id) {
            if (!cell.field(CellHasSelectionField)) {
              let transaction = cell.update({
                effects: CellHasSelectionEffect.of(true),
              });
              transactions_to_send_to_cells.push(transaction);
              cells[cell_id] = transaction.state;
            }
          } else {
            if (cell.field(CellHasSelectionField)) {
              let transaction = cell.update({
                effects: CellHasSelectionEffect.of(false),
              });
              transactions_to_send_to_cells.push(transaction);
              cells[cell_id] = transaction.state;
            }
          }
        }

        // Should this facet be pulled from the nexus, or the cell? (OR BOTH??)
        // TODO Enable this when I see a reason to use this over good ol' transactionExtenders
        // let cell_transaction_makers = transaction.startState.facet(
        //   cellTransactionForTransaction
        // );
        // if (cell_transaction_makers?.length !== 0) {
        //   for (let [cell_id, cell_state] of Object.entries(cells)) {
        //     let current_cell_state = cell_state;
        //     for (let cell_transaction_maker of cell_transaction_makers) {
        //       let specs_to_add = cell_transaction_maker(transaction, cell_state);
        //       if (specs_to_add) {
        //         let transaction = cell_state.update(specs_to_add);
        //         transactions_to_send_to_cells[cell_id].push(transaction);
        //         current_cell_state = transaction.state;
        //       }
        //     }
        //     cells[cell_id] = current_cell_state;
        //   }
        // }
      });
    } catch (error) {
      console.error(error);
      throw new Error(`Error while updating NestedEditorStatesField: ${error}`);
    }
  },
});

// Wanted to make this a normal function, but I need to memo some stuff,
// So it's a hook now
export let useNestedViewUpdate = (
  viewupdate: GenericViewUpdate<EditorInChief>,
  cell_id: EditorId
): GenericViewUpdate<EditorState> => {
  // Wrap every transaction in EditorDispatchEffect's
  let nested_dispatch = React.useMemo(() => {
    return (...transactions: import("@codemirror/state").TransactionSpec[]) => {
      viewupdate.view.dispatch(
        ...transactions.map((tr) => ({
          annotations: tr.annotations,
          effects: EditorDispatchEffect.of({
            cell_id: cell_id,
            transaction: tr,
          }),
        }))
      );
    };
  }, [viewupdate.view.dispatch]);

  let nested_editor_state = React.useMemo(() => {
    return viewupdate.state.field(NestedEditorStatesField).cells[cell_id];
  }, [viewupdate.state]);

  let nested_transactions = React.useMemo(() => {
    // Because we get one `viewupdate` for multiple transactions happening,
    // and `.transactions_to_send_to_cells` gets cleared after every transactions,
    // we have to go over all the transactions in the `viewupdate` and collect `.transactions_to_send_to_cells`s.
    let all_cell_transactions = viewupdate.transactions.flatMap(
      (transaction) => {
        return transaction.state.field(NestedEditorStatesField)
          .transactions_to_send_to_cells;
      }
    );
    return all_cell_transactions.filter((transaction) => {
      return transaction.startState.facet(EditorIdFacet) === cell_id;
    });
  }, [viewupdate.transactions]);

  return React.useMemo(() => {
    return new GenericViewUpdate(nested_transactions, {
      state: nested_editor_state,
      dispatch: nested_dispatch,
    });
  }, [nested_transactions, nested_editor_state, nested_dispatch]);
};

export let inverted_add_remove_editor = invertedEffects.of((transaction) => {
  /** @type {Array<StateEffect<any>>} */
  let inverted_effects = [];
  for (let effect of transaction.effects) {
    if (effect.is(CellAddEffect)) {
      inverted_effects.push(
        CellRemoveEffect.of({
          cell_id: effect.value.cell_id,
        })
      );
    } else if (effect.is(CellRemoveEffect)) {
      let { cell_id } = effect.value;
      let cell_state = transaction.startState.field(NestedEditorStatesField)
        .cells[cell_id];
      inverted_effects.push(
        CellAddEffect.of({
          cell_id: cell_id,
          state: cell_state,
        })
      );
    }
  }
  return inverted_effects;
});