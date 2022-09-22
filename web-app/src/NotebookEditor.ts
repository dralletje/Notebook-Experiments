import {
  Annotation,
  Compartment,
  EditorState,
  Facet,
  StateEffect,
  StateField,
  Transaction,
  TransactionSpec,
} from "@codemirror/state";
import { Cell, CellId, Notebook } from "./notebook-types";
import immer from "immer";
import { useRealMemo } from "use-real-memo";
import React from "react";
import { compact, without, zip } from "lodash";
import { SingleEventEmitter } from "single-event-emitter";
import { ViewPlugin } from "@codemirror/view";
import { basic_javascript_setup } from "./codemirror-javascript-setup";

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

function useEvent(handler) {
  const handlerRef = React.useRef(handler);

  handlerRef.current = handler;

  return React.useCallback((...args) => {
    return handlerRef.current(...args);
  }, []);
}

export let updateListener = Facet.define<(update: NotebookUpdate) => void>({
  combine: (listeners) => listeners,
});

export let AddCellEffect = StateEffect.define<{ index: number; cell: Cell }>();

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

export let NotebookFacet: Facet<Notebook, Notebook> = Facet.define({
  combine: (x) => x[0],
});

export let MutateNotebookEffect = StateEffect.define<{
  mutate_fn: (notebook: Notebook) => void;
}>();

export let NotebookField = StateField.define<Notebook>({
  create() {
    let id = "initial-cell-id";
    return {
      cell_order: [id],
      id: "notebook-id",
      cells: {
        [id]: {
          id: id,
          code: "",
          last_run: -Infinity,
          unsaved_code: "",
        },
      },
    };
  },

  update(notebook, transaction) {
    return immer(notebook, (notebook) => {
      for (let effect of transaction.effects) {
        if (effect.is(MutateNotebookEffect)) {
          effect.value.mutate_fn(notebook);
        }
      }
    });
  },
});

export let CellIdFacet = Facet.define<string, string>({
  combine: (x) => x[0],
});

export let NexusFacet = Facet.define<NotebookView, NotebookView>({
  combine: (x) => x[0],
});

export let ForNexusEffect = StateEffect.define<StateEffect<any>>();

// TODO Could also do this in the cells dispatch override stuff...
// export let expand_cell_effects_that_area_actually_meant_for_the_nexus =
//   EditorState.transactionExtender.of((transaction) => {
//     let moar_effects: Array<StateEffect<any>> = [];
//     for (let effect of transaction.effects) {
//       if (effect.is(FromCellTransactionEffect)) {
//         let { cell_id, transaction } = effect.value;
//         for (let effect of transaction.effects) {
//           if (effect.is(ForNexusEffect)) {
//             moar_effects.push(effect.value);
//           }
//         }
//       }
//     }

//     if (moar_effects.length > 0) {
//       console.log(`moar_effects:`, moar_effects);
//       return { effects: moar_effects };
//     }
//     return null;
//   });

let cellTransactionForTransaction =
  Facet.define<
    (
      transaction: Transaction,
      cell_state: EditorState
    ) => TransactionSpec | null
  >();

export let FromCellTransactionEffect = StateEffect.define<{
  cell_id: CellId;
  transaction: Transaction;
}>();

export let TransactionFromNexusToCellEmitterFacet = Facet.define<
  SingleEventEmitter<Transaction>,
  SingleEventEmitter<Transaction>
>({
  combine: (x) => x[0],
});

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

export let editor_state_for_cell = (cell: Cell, nexus_state: EditorState) => {
  let event_emitter = new SingleEventEmitter<Transaction>();
  return EditorState.create({
    doc: cell.unsaved_code,
    extensions: [
      CellIdFacet.of(cell.id),
      TransactionFromNexusToCellEmitterFacet.of(event_emitter),

      CellMetaField.init(() => ({
        code: cell.code,
        is_waiting: cell.is_waiting,
        last_run: cell.last_run,
        folded: cell.folded,
      })),

      ViewPlugin.define((cell_editor_view) => {
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
      }),
    ],
  });
};

export let CellEditorStatesField = StateField.define<{
  cell_order: Array<CellId>;
  cells: { [key: CellId]: Transaction };
}>({
  create() {
    return {
      cell_order: [],
      cells: {},
    };
  },
  update(state, transaction) {
    console.log(`EFFECTS FOR UPDATE:`, transaction.effects);

    return immer(state, ({ cells: _cells, cell_order }) => {
      let cells = _cells as any as { [key: CellId]: Transaction };

      for (let effect of transaction.effects) {
        if (effect.is(FromCellTransactionEffect)) {
          let { cell_id, transaction } = effect.value;

          if (cells[cell_id].state !== transaction.startState) {
            console.log(`map.get(cell_id)?.state !== transaction.startState:`, {
              map: cells,
              state: cells[cell_id].state,
              startState: transaction.startState,
            });
            // prettier-ignore
            throw new Error(`Updating cell state for Cell(${cell_id}) but the cell state is not the same as the transaction start state`);
          }
          cells[cell_id] = transaction;
        }

        if (effect.is(AddCellEffect)) {
          let { index, cell } = effect.value;
          console.log(`ADD CELL EFFECT index, cell:`, index, cell);
          cells[cell.id] = editor_state_for_cell(
            cell,
            transaction.state
          ).update({});
          cell_order.splice(index, 0, cell.id);
        }

        if (effect.is(RemoveCellEffect)) {
          let { cell_id } = effect.value;
          console.log(`REMOVE CELL EFFECT cell_id:`, cell_id);
          delete cells[cell_id];
          cell_order = without(cell_order, cell_id);
        }

        if (effect.is(MoveCellEffect)) {
          let { cell_id, from, to } = effect.value;
          console.log(`MOVE CELL EFFECT cell_id, from, to:`, cell_id, from, to);
          let [cell_id_we_removed] = cell_order.splice(from, 1);
          if (cell_id_we_removed !== cell_id) {
            // prettier-ignore
            throw new Error(`cell_id_we_removed !== cell_id: ${cell_id_we_removed} !== ${cell_id}`);
          }

          cell_order.splice(to, 0, cell_id);
        }

        if (effect.is(RunCellEffect)) {
          let { cell_id, at } = effect.value;

          let code = cells[cell_id].state.doc.toString();
          cells[cell_id] = cells[cell_id].state.update({
            effects: [
              MutateCellMetaEffect.of((cell) => {
                cell.code = code;
                cell.is_waiting = true;
                cell.last_run = at;
              }),
            ],
          });
        }

        if (effect.is(RunIfChangedCellEffect)) {
          let { cell_id, at } = effect.value;

          let code = cells[cell_id].state.doc.toString();
          if (code !== cells[cell_id].state.field(CellMetaField).code) {
            cells[cell_id] = cells[cell_id].state.update({
              effects: [
                MutateCellMetaEffect.of((cell) => {
                  cell.code = code;
                  cell.is_waiting = true;
                  cell.last_run = at;
                }),
              ],
            });
          }
        }
      }
    });

    // Should this facet be pulled from the nexus, or the cell? (OR BOTH??)
    // TODO re-enable this when you use it!
    // let cell_transaction_makers = transaction.startState.facet(
    //   cellTransactionForTransaction
    // );
    // if (cell_transaction_makers?.length !== 0) {
    //   for (let [cell_id, last_cell_transaction] of map) {
    //     let cell_transaction = last_cell_transaction;
    //     for (let cell_transaction_maker of cell_transaction_makers) {
    //       let specs_to_add = cell_transaction_maker(
    //         transaction,
    //         cell_transaction.state
    //       );
    //       if (specs_to_add) {
    //         cell_transaction = cell_transaction.state.update(specs_to_add);
    //       }
    //     }
    //     if (cell_transaction !== last_cell_transaction) {
    //       mutate_map().set(cell_id, cell_transaction);
    //     }
    //   }
    // }
  },
});

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
        transaction: cell_editor_state.state.update(spec),
      }),
    ],
  });
};

export let updateCellsFromNexus = updateListener.of((viewupdate) => {
  let start_transactions = viewupdate.startState.field(CellEditorStatesField);
  let transactions = viewupdate.state.field(CellEditorStatesField).cells;

  for (let [cell_id, transaction] of Object.entries(transactions)) {
    let start_transaction = start_transactions.cells[cell_id];
    if (start_transaction && start_transaction !== transaction) {
      let emitter = transaction.state.facet(
        TransactionFromNexusToCellEmitterFacet
      );
      emitter.emit(transaction);
    }
  }
});

/**
 * @param {{
 *  extensions: Array<import("@codemirror/state").Extension>,
 * }} props
 */
export let useNotebookviewWithExtensions = ({
  extensions,
}: {
  extensions: Array<import("@codemirror/state").Extension>;
}) => {
  let initial_extensions = React.useRef(extensions).current;
  let previous_extensions_ref = React.useRef(extensions);

  if (previous_extensions_ref.current.length !== extensions.length) {
    // prettier-ignore
    throw new Error(`Can't change the amount of extensions in useCodemirrorEditorviewWithExtensions`);
  }

  let compartments = useRealMemo(() => {
    return extensions.map((extension) => new Compartment());
  }, []);

  let initial_notebook_state = useRealMemo(() => {
    return EditorState.create({
      extensions: zip(compartments, initial_extensions).map(
        // @ts-ignore trust me, `compartments` and `extensions` are the same length
        ([compartment, extension]) => compartment.of(extension)
      ),
    });
  }, []);

  let [_notebook_state, set_notebook_state] = React.useState(
    initial_notebook_state
  );

  let reconfigures = compact(
    zip(compartments, extensions, previous_extensions_ref.current).map(
      ([compartment, extension, previous_extension]) => {
        if (extension !== previous_extension) {
          // console.log(`UPDATING EXTENSION:`, {
          //   extension,
          //   previous_extension,
          // });
          // @ts-ignore
          return compartment.reconfigure(extension);
        } else {
          return null;
        }
      }
    )
  );
  previous_extensions_ref.current = extensions;
  if (reconfigures.length > 0) {
    _notebook_state = _notebook_state.update({
      effects: reconfigures,
    }).state;
  }

  let notebook_dispatch = useEvent(
    (...transaction_specs: TransactionSpec[]) => {
      // console.log(`Receiving transaction at nexus:`, transaction_specs);
      if (transaction_specs.length !== 0) {
        // TODO Not sure yet if having this inside the state mapper is the right thing to do
        // .... or we should instead do it with `_notebook_state` here
        set_notebook_state((state) => {
          let transaction = state.update(...transaction_specs);

          for (let listener of state.facet(updateListener)) {
            listener({
              transactions: [transaction],
              view: {
                state: transaction.state,
                dispatch: notebook_dispatch,
              },
              startState: state,
              state: transaction.state,
            });
          }

          return transaction.state;
        });

        // set_notebook_state(transaction.state);
      }
    }
  );

  return { state: _notebook_state, dispatch: notebook_dispatch };
};
