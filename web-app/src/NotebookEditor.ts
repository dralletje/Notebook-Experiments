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
import { useDidJustHotReload, useRealMemo } from "use-real-memo";
import React from "react";
import { compact, takeWhile, zip, remove, without } from "lodash";
import { SingleEventEmitter } from "single-event-emitter";
import { ViewPlugin } from "@codemirror/view";
import { invertedEffects } from "@codemirror/commands";
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

export type NotebookState = EditorState;

export type NotebookView = {
  state: NotebookState;
  dispatch: (...tr: TransactionSpec[]) => void;
};

export type NotebookUpdate = {
  transactions: Transaction[];
  view: NotebookView;
  startState: NotebookState;
  state: NotebookState;
};

export let updateListener = Facet.define<(update: NotebookUpdate) => void>({
  combine: (listeners) => listeners,
});

export type RelativeCellPosition = { after: CellId } | { before: CellId };
let cell_position_to_index = (
  position: RelativeCellPosition | number,
  cell_order: Array<CellId>
) => {
  if (typeof position === "number") {
    return position;
  }
  if ("after" in position) {
    return cell_order.indexOf(position.after) + 1;
  }
  if ("before" in position) {
    return cell_order.indexOf(position.before) - 1;
  }
  throw new Error("Invalid position");
};

export let AddCellEffect = StateEffect.define<{
  index: number | RelativeCellPosition;
  cell: Cell;
}>();

export let AddCellEditorStateEffect = StateEffect.define<{
  index: number;
  cell_id: CellId;
  cell_editor_state: EditorState;
}>();

export let RemoveCellEffect = StateEffect.define<{ cell_id: CellId }>();

export let MoveCellEffect = StateEffect.define<{
  cell_id: CellId;
  from: number;
  to: number;
}>();

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

export let CellPlugin = Facet.define<Extension>({ static: true });

// Not sure if the best way to fix this, but
// This makes it so cells and extensions can trigger CellDispatchEffect's,
// and they will be transformed into transactions that will be added as FromCellTransactionEffect's.
// This is because the rest of the extensions currently expect FromCellTransactionEffect instead of CellDispatchEffects.
// export let cell_dispatch_to_cell_transaction_extender =
//   EditorState.transactionExtender.of((transaction) => {
//     let new_states = new Map<CellId, EditorState>();
//     let cell_states = transaction.startState.field(CellEditorStatesField);

//     // console.trace(`transaction:`, transaction);
//     console.log("TRANSACTION EXTENDER START", { transaction });
//     let moar_effects: Array<StateEffect<any>> = [];
//     for (let effect of transaction.effects) {
//       if (effect.is(FromCellTransactionEffect)) {
//         console.log("Dafuq");
//         // prettier-ignore
//         throw new Error(`FromCellTransactionEffect can't be dispatched, only created by transactionExtender`);
//       }
//       if (effect.is(CellDispatchEffect)) {
//         let { cell_id, transaction: transaction_spec } = effect.value;
//         let new_state = new_states.get(cell_id) ?? cell_states.cells[cell_id];

//         if (transaction_spec instanceof Transaction) {
//           // prettier-ignore
//           console.warn('Hmmm, `CellDispatchEffect` transaction_spec is already a transaction');
//         }

//         console.log("cell_dispatch_to_cell_transaction_extender", {
//           cell_id,
//           transaction_spec,
//           new_state: new_states.get(cell_id),
//           cell_state: cell_states.cells[cell_id],
//         });

//         let transaction = new_state.update(transaction_spec);
//         new_states.set(cell_id, transaction.state);
//         moar_effects.push(
//           FromCellTransactionEffect.of({
//             cell_id,
//             transaction,
//           })
//         );
//       }
//     }

//     if (moar_effects.length > 0) {
//       return { effects: moar_effects };
//     }
//     return null;
//   });

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

export let NexusEffect = StateEffect.define<StateEffect<any>>();
let expand_cell_effects_that_area_actually_meant_for_the_nexus =
  EditorState.transactionExtender.of((transaction) => {
    let moar_effects: Array<StateEffect<any>> = [];
    for (let effect of transaction.effects) {
      if (effect.is(CellDispatchEffect)) {
        for (let cell_effect of cell_dispatch_effect_effects(effect)) {
          if (cell_effect.is(NexusEffect)) {
            moar_effects.push(cell_effect.value);
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

export let FromCellTransactionEffect = StateEffect.define<{
  cell_id: CellId;
  transaction: Transaction;
}>();

export let CellDispatchEffect = StateEffect.define<{
  cell_id: CellId;
  transaction: TransactionSpec | Transaction;
}>();

export let empty_cell = (type: "code" | "text" = "code") => {
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

let TransactionFromNexusToCellEmitterFacet = Facet.define<
  SingleEventEmitter<Transaction[]>,
  SingleEventEmitter<Transaction[]>
>({
  combine: (x) => x[0],
});
let emit_transaction_from_nexus_to_cell_extension = ViewPlugin.define(
  (cell_editor_view) => {
    let emitter = cell_editor_view.state.facet(
      TransactionFromNexusToCellEmitterFacet
    );
    let off = emitter.on((transactions) => {
      cell_editor_view.update(transactions);
    });
    return {
      destroy() {
        off();
      },
    };
  }
);

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

export let editor_state_for_cell = (cell: Cell, nexus_state: EditorState) => {
  let event_emitter = new SingleEventEmitter<Transaction[]>();
  let extensions = nexus_state.facet(CellPlugin);

  return EditorState.create({
    doc: cell.unsaved_code,
    extensions: [
      CellIdFacet.of(cell.id),
      CellMetaField.init(() => ({
        code: cell.code,
        is_waiting: cell.is_waiting,
        last_run: cell.last_run,
        folded: cell.folded,
      })),
      CellTypeFacet.of(cell.type ?? "code"),

      CellHasSelectionField,

      TransactionFromNexusToCellEmitterFacet.of(event_emitter),
      // emit_transaction_from_nexus_to_cell_extension,

      ...extensions,
    ],
  });
};

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

export let CellEditorStatesField = StateField.define<{
  cell_order: Array<CellId>;
  cells: { [key: CellId]: EditorState };
  /** So... I need this separate from the EditorState's selection,
   *  because EditorState.selection can't be empty/inactive */
  has_active_selection: { [key: CellId]: boolean };

  /** Necessary because the cells views need to be updated with the transactions
   *  🤩 Needs no cell_id because the emitter is on the transaction state 🤩 */
  transactions_to_send_to_cells: Array<Transaction>;
}>({
  create() {
    return {
      cell_order: [],
      cells: {},
      has_active_selection: {},

      transactions_to_send_to_cells: [],
    };
  },
  update(state, transaction) {
    let initial_state = state;
    return immer(state, (state) => {
      state.transactions_to_send_to_cells = [];
      let {
        cells: _cells,
        cell_order,
        transactions_to_send_to_cells: _transactions_to_send_to_cells,
      } = state;

      // Tell typescript it doesn't need to care about WritableDraft >_>
      let cells = _cells as any as { [key: CellId]: EditorState };
      let transactions_to_send_to_cells =
        _transactions_to_send_to_cells as any as Array<Transaction>;

      if (
        transaction.startState.facet(CellPlugin) !==
        transaction.state.facet(CellPlugin)
      ) {
        throw new Error(
          `Please don't change the CellPlugin facet yet... please`
        );
      }

      for (let effect of transaction.effects) {
        // So FromCellTransactionEffect is a bit iffy...
        // It can be that the startState this transaction is made from, is not the result
        // from (batched) CellDispatchEffect's that were applied to the state in this pass...
        // So I see if it was, in which case I happily apply it, but if it wasn't
        // I check if maybe it applies to the initial state for this pass, and apply it there (ignoring the CellDispatchEffects that came before)
        // I hope it works D:
        if (effect.is(FromCellTransactionEffect)) {
          let { cell_id, transaction } = effect.value;

          if (cells[cell_id] !== transaction.startState) {
            console.log(
              `FromCellTransactionEffect with different startState... Trying from initial state`,
              {
                map: cells,
                state: cells[cell_id],
                transaction: transaction,
              }
            );
            // prettier-ignore
            // throw new Error(`Updating cell state for Cell(${cell_id}) but the cell state is not the same as the transaction start state`);
            // continue

            if (initial_state.cells[cell_id] === transaction.startState) {
              remove(transactions_to_send_to_cells, tr => {
                return tr.startState.facet(CellIdFacet) === cell_id;
              })
              cells[cell_id] = transaction.state;
              continue
            } else {
              // prettier-ignore
              throw new Error(`Updating cell state for Cell(${cell_id}) but the cell state is not the same as the transaction start state`);
            }
          }
          transactions_to_send_to_cells.push(transaction);
          cells[cell_id] = transaction.state;
        }

        if (effect.is(CellDispatchEffect)) {
          let { cell_id, transaction: spec } = effect.value;
          let cell_state = cells[cell_id];

          if (cell_state == null) {
            // prettier-ignore
            console.warn(`CellDispatchEffect for Cell(${cell_id}) but no cell state exists`);
            continue;
          }

          let transaction = cell_state.update(spec);
          transactions_to_send_to_cells.push(transaction);
          cells[cell_id] = transaction.state;
        }

        if (effect.is(AddCellEffect)) {
          let { index, cell } = effect.value;
          console.log(`ADD CELL EFFECT index, cell:`, { index, cell });
          cells[cell.id] = editor_state_for_cell(cell, transaction.state);
          cell_order.splice(
            cell_position_to_index(index, cell_order),
            0,
            cell.id
          );
        }
        if (effect.is(AddCellEditorStateEffect)) {
          let { index, cell_id, cell_editor_state } = effect.value;
          // prettier-ignore
          console.log(`ADD CELL EDITORSTATE EFFECT index, cell:`, {index, cell_editor_state});
          cells[cell_id] = cell_editor_state;
          cell_order.splice(index, 0, cell_id);
        }

        if (effect.is(RemoveCellEffect)) {
          let { cell_id } = effect.value;
          console.log(`REMOVE CELL EFFECT cell_id:`, { cell_id });
          delete cells[cell_id];
          cell_order.splice(cell_order.indexOf(cell_id), 1);
        }

        if (effect.is(MoveCellEffect)) {
          let { cell_id, from, to } = effect.value;
          // prettier-ignore
          console.log(`MOVE CELL EFFECT cell_id, from, to:`, {cell_id, from, to});
          let [cell_id_we_removed] = cell_order.splice(from, 1);
          if (cell_id_we_removed !== cell_id) {
            // prettier-ignore
            throw new Error(`cell_id_we_removed !== cell_id: ${cell_id_we_removed} !== ${cell_id}`);
          }

          cell_order.splice(to, 0, cell_id);
        }

        if (effect.is(RunCellEffect)) {
          let { cell_id, at } = effect.value;

          let code = cells[cell_id].doc.toString();
          let transaction = cells[cell_id].update({
            effects: [
              MutateCellMetaEffect.of((cell) => {
                cell.code = code;
                cell.is_waiting = true;
                cell.last_run = at;
              }),
            ],
          });
          transactions_to_send_to_cells.push(transaction);
          cells[cell_id] = transaction.state;
        }

        if (effect.is(RunIfChangedCellEffect)) {
          let { cell_id, at } = effect.value;
          let code = cells[cell_id].doc.toString();
          if (code !== cells[cell_id].field(CellMetaField).code) {
            let transaction = cells[cell_id].update({
              effects: [
                MutateCellMetaEffect.of((cell) => {
                  cell.code = code;
                  cell.is_waiting = true;
                  cell.last_run = at;
                }),
              ],
            });
            transactions_to_send_to_cells.push(transaction);
            cells[cell_id] = transaction.state;
          }
        }
      }

      // Go through all transactions to find out what cells
      state.has_active_selection ??= {};
      for (let transaction of transactions_to_send_to_cells) {
        if (transaction.selection != null) {
          state.has_active_selection = {
            [transaction.startState.facet(CellIdFacet)]: true,
          };
        }
      }
      for (let cell_id of cell_order) {
        if (state.has_active_selection[cell_id]) {
          let cell = cells[cell_id];
          if (!cell.field(CellHasSelectionField)) {
            let transaction = cell.update({
              effects: CellHasSelectionEffect.of(true),
            });
            transactions_to_send_to_cells.push(transaction);
            cells[cell_id] = transaction.state;
          }
        } else {
          let cell = cells[cell_id];
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
  },
});

let invert_removing_and_adding_cells = invertedEffects.of((transaction) => {
  let notebook = transaction.startState.field(CellEditorStatesField);
  let inverted_effects: Array<StateEffect<any>> = [];
  for (let effect of transaction.effects) {
    if (effect.is(AddCellEffect)) {
      inverted_effects.push(
        RemoveCellEffect.of({ cell_id: effect.value.cell.id })
      );
    }
    if (effect.is(RemoveCellEffect)) {
      let cell_id = effect.value.cell_id;
      inverted_effects.push(
        AddCellEditorStateEffect.of({
          cell_id: cell_id,
          index: notebook.cell_order.indexOf(cell_id),
          cell_editor_state: notebook.cells[cell_id],
        })
      );
    }
    if (effect.is(MoveCellEffect)) {
      let { cell_id, from, to } = effect.value;
      inverted_effects.push(
        MoveCellEffect.of({
          cell_id,
          from: to,
          to: from,
        })
      );
    }
  }
  return inverted_effects;
});

let updateCellsFromNexus = updateListener.of((viewupdate) => {
  // Because we get one `viewupdate` for multiple transactions happening,
  // and `.transactions_to_send_to_cells` gets cleared after every transactions,
  // we have to go over all the transactions in the `viewupdate` and collect `.transactions_to_send_to_cells`s.
  let cell_transactions = viewupdate.transactions.flatMap((transaction) => {
    return transaction.state.field(CellEditorStatesField)
      .transactions_to_send_to_cells;
  });

  // We don't want to send an viewupdate to cells that weren't initialized before this viewupdate started.
  // Because their state will already be the latest state we have here, and we don't want to send them a viewupdate.
  let pre_existing_cells = viewupdate.startState.field(
    CellEditorStatesField
  ).cells;

  // We bunch up all the transactions into one viewupdate for each cell.
  let transactions_per_cell = new Map<
    SingleEventEmitter<Transaction[]>,
    Array<Transaction>
  >();
  for (let transaction of cell_transactions) {
    let id = transaction.startState.facet(CellIdFacet);
    if (!(id in pre_existing_cells)) return;

    let emitter = transaction.startState.facet(
      TransactionFromNexusToCellEmitterFacet
    );
    if (!transactions_per_cell.has(emitter)) {
      transactions_per_cell.set(emitter, []);
    }
    transactions_per_cell.get(emitter)!.push(transaction);
  }
  // for (let [emitter, transactions] of transactions_per_cell) {
  //   emitter.emit(transactions);
  // }
});

export let nested_cell_states_basics = [
  CellEditorStatesField,
  invert_removing_and_adding_cells,
  updateCellsFromNexus,
  add_single_cell_when_all_cells_are_removed,
  expand_cell_effects_that_area_actually_meant_for_the_nexus,
];

export let update_cell_state = (
  nexus_state: NotebookState,
  cell_id: CellId,
  spec: TransactionSpec
) => {
  let cell_editor_states = nexus_state.field(CellEditorStatesField);
  let cell_editor_state = cell_editor_states.cells[cell_id];
  if (cell_editor_state == null)
    throw new Error(`No cell found for "${cell_id}`);
  // return nexus_state.update({
  //   effects: [
  //     FromCellTransactionEffect.of({
  //       cell_id,
  //       transaction: cell_editor_state.update(spec),
  //     }),
  //   ],
  // });
  return {
    effects: [CellDispatchEffect.of({ cell_id, transaction: spec })],
  };
};

let useImmediateRerenderCounter = () => {
  let ref = React.useRef(-1);
  // ref.current = ref.current + 1;
  React.useLayoutEffect(() => {
    ref.current = -1;
  });
  return ref;
};

export let useNotebookviewWithExtensions = ({
  extensions,
}: {
  extensions: Array<import("@codemirror/state").Extension>;
}) => {
  let initial_extensions_ref = React.useRef(extensions);
  let previous_extensions_ref = React.useRef(extensions);

  let did_just_hot_reload = useDidJustHotReload();
  if (previous_extensions_ref.current.length !== extensions.length) {
    if (did_just_hot_reload) {
      // Allowing changing amount of extension during hot-reload,
      // will totally reload the editor then (which is fine during hot-reload)
      initial_extensions_ref.current = extensions;
      previous_extensions_ref.current = extensions;
    } else {
      // prettier-ignore
      throw new Error(`Can't change the amount of extensions in useCodemirrorEditorviewWithExtensions`);
    }
  }
  let initial_extensions = initial_extensions_ref.current;

  // Above is just to make it easier to hot-reload and give nice errors when you change the amount of extensions at runtime
  // What follows is the actual extension 🙃

  let compartments = useRealMemo(() => {
    return initial_extensions.map((extension) => new Compartment());
  }, [initial_extensions]);

  let initial_state = useRealMemo(() => {
    return EditorState.create({
      extensions: zip(compartments, initial_extensions).map(
        // @ts-ignore trust me, `compartments` and `extensions` are the same length
        ([compartment, extension]) => compartment.of(extension)
      ),
    });
  }, [compartments]);

  let [state, set_state] = React.useState(initial_state);

  // prettier-ignore
  { // HOT RELOADING TWEAK - I hate myself but I am too far in now
    let last_initial_state_ref = React.useRef(initial_state)
    if (last_initial_state_ref.current !== initial_state) {
      set_state(initial_state)
      last_initial_state_ref.current = initial_state
    }
  } // END HOT RELOADING TWEAK

  let reconfigures = compact(
    zip(compartments, extensions, previous_extensions_ref.current).map(
      ([compartment, extension, previous_extension]) => {
        if (extension !== previous_extension) {
          // @ts-ignore
          return compartment.reconfigure(extension);
        } else {
          return null;
        }
      }
    )
  );
  let reconfigures_counter = useImmediateRerenderCounter();
  if (reconfigures.length > 0) {
    // PREVENT AN INFINITE LOOP BECAUSE OF "UNSTABLE" EXTENSIONS
    {
      if (reconfigures_counter.current > 10) {
        let indexes_that_changed = compact(
          zip(extensions, previous_extensions_ref.current).map(
            ([extension, previous_extension], index) =>
              extension !== previous_extension ? index : null
          )
        );
        // prettier-ignore
        throw new Error(`
Seems like one of the extensions you passed to useNotebookviewWithExtensions is unstable (changes every render), causing an infinite loop.
You likely want to wrap that extension in a React.useMemo() call.
(The extensions that changed are at index ${indexes_that_changed.join(", ")} in the extensions array you passed to useNotebookviewWithExtensions)`);
      }
      reconfigures_counter.current++;
    }

    // Recently learned that it is _OK_ to put a setState in render?
    // It still runs this function, but will discard everything and re-run, which is what I want.
    set_state(
      state.update({
        effects: reconfigures,
      }).state
    );
    previous_extensions_ref.current = extensions;
  }

  // I feel dirty for using a ref STILL, after all my hard work to get rid of them.
  let transactions_to_apply_ref = React.useRef<Transaction[]>([]);

  // Used `useEvent` here before, because I wasn't using the setState-render loop to sync the children...
  // Now that is fixed, I don't need the immediate update stuff anymore... don't need any update actually!
  // I think `set_notebook_transaction` is completely stable so... cool 😎
  let notebook_dispatch = React.useCallback(
    (...transaction_specs: TransactionSpec[]) => {
      // console.log(`Receiving transaction at nexus:`, transaction_specs);
      if (transaction_specs.length !== 0) {
        // Problem with this state mapper is that multiple calls in the same render will cause the other transactions to be swallowed.
        // So I have to use a ref to store them, and then apply them all in the next render.
        set_state((state) => {
          let transaction = state.update(...transaction_specs);
          transactions_to_apply_ref.current.push(transaction);
          return transaction.state;
        });
      }
    },
    [set_state]
  );

  React.useLayoutEffect(() => {
    // Only of these listeners will do the cell_editor_view.update() calls
    // after a transaction, which is nice! That means the cell_editor_views won't
    // do any dom mutations until this layout effect is done!
    // So everything stays in sync 🤩
    // This _might_ just work with async react.
    // TODO? Maybe the stuff that applies the `cell_editor_view.update()` should be
    // ..... in sync with component it is in, instead of this parent component? Food for thought/improvement.

    // I'm still going to do a premature optimisation here, specifically to avoid applying transactions that
    // React with all it's sync magic, might not have updated the state for yet (aiming at the gap between setState and ref.current = mutation)
    // Not sure if will happen a bit, but I'm in an overengineering mood.
    let transactions_to_apply_now = takeWhile(
      transactions_to_apply_ref.current,
      (transaction) => transaction.startState !== state
    );
    transactions_to_apply_ref.current = transactions_to_apply_ref.current.slice(
      transactions_to_apply_now.length
    );

    if (transactions_to_apply_now.length > 0) {
      let startState = transactions_to_apply_now.at(0)!.state;
      let state = transactions_to_apply_now.at(-1)!.state;
      for (let listener of state.facet(updateListener)) {
        listener({
          transactions: transactions_to_apply_now,
          view: {
            state: state,
            dispatch: notebook_dispatch,
          },
          startState: startState,
          state: state,
        });
      }
    }
  }, [state]);

  return { state: state, dispatch: notebook_dispatch };
};

export class ViewUpdate {
  constructor(public transactions: Transaction[], public view: NotebookView) {
    // TODO Check if the transactions are actually in order?
  }
  get state() {
    return this.view.state;
  }
  get startState() {
    return this.transactions[0]?.state ?? this.view.state;
  }
}

// TODO This now only looks at the transactions linearly, might want to
// .... add the ability to find "rogue" transactions that deviated (and should be removed)
let find_transactions_to_apply = (
  transactions: Transaction[],
  state: EditorState
) => {
  let transactions_to_apply_now = takeWhile(
    transactions,
    (transaction) => transaction.startState !== state
  );
  return transactions_to_apply_now;
};

/**
 * So this is a funny function:
 * It takes a state and a onChange function for the state, but it returns a `ViewUpdate`.
 * This `ViewUpdate` is not the Codemirror `ViewUpdate`, as it doesn't necessarily have a document, so no `changes` or `docChanged` etc.
 * But it is a batch of all the "flushed" transactions that happened in to state during this React render.
 * Updating the state has to go though the `viewupdate.view.dispatch`, or else the view should be reset.
 */
export let useViewUpdate = (
  state: EditorState,
  on_change: (state: EditorState) => void
) => {
  // I feel dirty for using a ref STILL, after all my hard work to get rid of them.
  let transactions_to_apply_ref = React.useRef<Transaction[]>([]);
  // But now I do use refs, I'll fuckin' use them
  let current_state = React.useRef(state);
  current_state.current = state;

  // Hope that the way I use with refs and all (and not useState) is not a problem?
  let notebook_dispatch = React.useCallback(
    (...transaction_specs: TransactionSpec[]) => {
      // console.log(`Receiving transaction at nexus:`, transaction_specs);
      if (transaction_specs.length !== 0) {
        // Problem with this state mapper is that multiple calls in the same render will cause the other transactions to be swallowed.
        // So I have to use a ref to store them, and then apply them all in the next render.
        let state = current_state.current;
        let transaction = state.update(...transaction_specs);
        transactions_to_apply_ref.current.push(transaction);
        current_state.current = transaction.state;

        on_change(transaction.state);
      }
    },
    [current_state, transactions_to_apply_ref]
  );

  // To apply the transactions to the view, we need to pass the whole viewupdate down to the codemirror instances.
  // To do so, we make this viewupdate every render.
  // It uses the `transactions_to_apply_ref`, which is odd because using a ref in render?
  // YES!
  // We want to make sure the childrens `useLayoutEffect`s only apply the transactions once,
  // and I think this works where I use the ref, and then in this parent useLayoutEffect I clear the ref.
  let transactions_to_apply_now = find_transactions_to_apply(
    transactions_to_apply_ref.current,
    state
  );
  let viewupdate = React.useMemo(() => {
    return new ViewUpdate(transactions_to_apply_now, {
      state,
      dispatch: notebook_dispatch,
    });
  }, [state]);

  React.useLayoutEffect(() => {
    if (viewupdate.transactions.length > 0) {
      // This will clear the ref from any transactions that I'm sending down now
      transactions_to_apply_ref.current = without(
        transactions_to_apply_ref.current,
        ...viewupdate.transactions
      );
      // Trigger `updateListeners.of(...)`, not used right now I think
      for (let listener of viewupdate.state.facet(updateListener)) {
        listener(viewupdate);
      }
    }
  }, [viewupdate, transactions_to_apply_ref]);

  return viewupdate;
};
