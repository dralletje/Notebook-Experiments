import {
  Compartment,
  EditorState,
  Extension,
  Facet,
  StateEffect,
  StateField,
  Transaction,
  TransactionSpec,
} from "@codemirror/state";
import { Cell, CellId, Notebook } from "./notebook-types";
import immer from "immer";
import { useDidJustHotReload, useRealMemo } from "use-real-memo";
import React from "react";
import { compact, takeWhile, zip } from "lodash";
import { SingleEventEmitter } from "single-event-emitter";
import { ViewPlugin } from "@codemirror/view";
import { invertedEffects } from "@codemirror/commands";
import { v4 as uuidv4 } from "uuid";

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

export let AddCellEffect = StateEffect.define<{ index: number; cell: Cell }>();

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

export let NexusEffect = StateEffect.define<StateEffect<any>>();
let expand_cell_effects_that_area_actually_meant_for_the_nexus =
  EditorState.transactionExtender.of((transaction) => {
    let moar_effects: Array<StateEffect<any>> = [];
    for (let effect of transaction.effects) {
      if (effect.is(FromCellTransactionEffect)) {
        let { cell_id, transaction } = effect.value;
        for (let effect of transaction.effects) {
          if (effect.is(NexusEffect)) {
            moar_effects.push(effect.value);
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
  transaction: TransactionSpec;
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
  SingleEventEmitter<Transaction>,
  SingleEventEmitter<Transaction>
>({
  combine: (x) => x[0],
});
let emit_transaction_from_nexus_to_cell_extension = ViewPlugin.define(
  (cell_editor_view) => {
    let emitter = cell_editor_view.state.facet(
      TransactionFromNexusToCellEmitterFacet
    );
    let off = emitter.on((transaction) => {
      cell_editor_view.update([transaction]);
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

export let editor_state_for_cell = (cell: Cell, nexus_state: EditorState) => {
  let event_emitter = new SingleEventEmitter<Transaction>();
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

      TransactionFromNexusToCellEmitterFacet.of(event_emitter),
      emit_transaction_from_nexus_to_cell_extension,

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

  /** Necessary because the cells views need to be updated with the transactions
   *  🤩 Needs no cell_id because the emitter is on the transaction state 🤩 */
  transactions_to_send_to_cells: Array<Transaction>;
}>({
  create() {
    return {
      cell_order: [],
      cells: {},

      transactions_to_send_to_cells: [],
    };
  },
  update(state, transaction) {
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
        if (effect.is(FromCellTransactionEffect)) {
          let { cell_id, transaction } = effect.value;

          if (cells[cell_id] !== transaction.startState) {
            console.log(`map.get(cell_id)?.state !== transaction.startState:`, {
              map: cells,
              state: cells[cell_id],
              startState: transaction.startState,
            });
            // prettier-ignore
            throw new Error(`Updating cell state for Cell(${cell_id}) but the cell state is not the same as the transaction start state`);
          }
          transactions_to_send_to_cells.push(transaction);
          cells[cell_id] = transaction.state;
        }

        if (effect.is(CellDispatchEffect)) {
          let { cell_id, transaction: spec } = effect.value;
          let cell_state = cells[cell_id];
          let transaction = cell_state.update(spec);
          transactions_to_send_to_cells.push(transaction);
          cells[cell_id] = transaction.state;
        }

        if (effect.is(AddCellEffect)) {
          let { index, cell } = effect.value;
          console.log(`ADD CELL EFFECT index, cell:`, { index, cell });
          cells[cell.id] = editor_state_for_cell(cell, transaction.state);
          cell_order.splice(index, 0, cell.id);
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
  let transactions = viewupdate.state.field(
    CellEditorStatesField
  ).transactions_to_send_to_cells;

  for (let transaction of transactions) {
    // Get the emitter, FROM THE TRANSACTION?? WHAAAAAT that's crazy!!
    let emitter = transaction.startState.facet(
      TransactionFromNexusToCellEmitterFacet
    );
    emitter.emit(transaction);
  }
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
  return nexus_state.update({
    effects: [
      FromCellTransactionEffect.of({
        cell_id,
        transaction: cell_editor_state.update(spec),
      }),
    ],
  });
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

    for (let transaction of transactions_to_apply_now) {
      for (let listener of transaction.state.facet(updateListener)) {
        listener({
          transactions: [transaction],
          view: {
            state: transaction.state,
            dispatch: notebook_dispatch,
          },
          startState: transaction.startState,
          state: transaction.state,
        });
      }
    }
  }, [state]);

  return { state: state, dispatch: notebook_dispatch };
};
