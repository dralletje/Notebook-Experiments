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
        if (effect.is(AddCellEffect)) {
          let { index, cell } = effect.value;
          console.log(`ADD CELL EFFECT index, cell:`, index, cell);
          notebook.cells[cell.id] = cell;
          notebook.cell_order.splice(index, 0, cell.id);
        }
        if (effect.is(RemoveCellEffect)) {
          let { cell_id } = effect.value;
          console.log(`REMOVE CELL EFFECT cell_id:`, cell_id);
          delete notebook.cells[cell_id];
          notebook.cell_order = without(notebook.cell_order, cell_id);
        }

        if (effect.is(MoveCellEffect)) {
          let { cell_id, from, to } = effect.value;
          console.log(`MOVE CELL EFFECT cell_id, from, to:`, cell_id, from, to);
          let [cell_id_we_removed] = notebook.cell_order.splice(from, 1);
          if (cell_id_we_removed !== cell_id) {
            // prettier-ignore
            throw new Error(`cell_id_we_removed !== cell_id: ${cell_id_we_removed} !== ${cell_id}`);
          }

          notebook.cell_order.splice(to, 0, cell_id);
        }

        if (effect.is(RunCellEffect)) {
          console.log(`effect:`, effect);
          let { cell_id, at } = effect.value;

          let cell = notebook.cells[cell_id];
          cell.code = cell.unsaved_code;
          cell.is_waiting = true;
          cell.last_run = at;
        }

        if (effect.is(RunIfChangedCellEffect)) {
          let { cell_id, at } = effect.value;

          let cell = notebook.cells[cell_id];
          if (cell.code !== cell.unsaved_code) {
            cell.code = cell.unsaved_code;
            cell.is_waiting = true;
            cell.last_run = at;
          }
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
export let expand_cell_effects_that_area_actually_meant_for_the_nexus =
  EditorState.transactionExtender.of((transaction) => {
    let moar_effects: Array<StateEffect<any>> = [];
    for (let effect of transaction.effects) {
      if (effect.is(FromCellTransactionEffect)) {
        let { cell_id, transaction } = effect.value;
        for (let effect of transaction.effects) {
          if (effect.is(ForNexusEffect)) {
            moar_effects.push(effect.value);
          }
        }
      }
    }

    if (moar_effects.length > 0) {
      console.log(`moar_effects:`, moar_effects);
      return { effects: moar_effects };
    }
    return null;
  });

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

let editor_state_for_cell = (cell: Cell, nexus_state: EditorState) => {
  let event_emitter = new SingleEventEmitter<Transaction>();
  return EditorState.create({
    doc: cell.unsaved_code,
    extensions: [
      CellIdFacet.of(cell.id),
      TransactionFromNexusToCellEmitterFacet.of(event_emitter),
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

export let CellEditorStatesField = StateField.define<Map<CellId, Transaction>>({
  create(state) {
    let notebook = state.field(NotebookField);

    return new Map(
      notebook.cell_order.map(
        (cell_id) =>
          [
            cell_id,
            editor_state_for_cell(notebook.cells[cell_id], state).update({}),
          ] as const
      )
    );
  },
  update(map, transaction) {
    let did_copy = false;
    let mutate_map = () => {
      if (!did_copy) {
        did_copy = true;
        map = new Map(map);
      }
      return map;
    };

    //  Create new editor state for new cells in notebook
    //  Remove editor state for removed cells in notebook
    let notebook = transaction.state.field(NotebookField);
    let cell_order = notebook.cell_order;
    if (cell_order !== transaction.startState.field(NotebookField).cell_order) {
      let cells = notebook.cells;
      for (let cell_id of cell_order) {
        if (!map.has(cell_id)) {
          mutate_map().set(
            cell_id,
            editor_state_for_cell(cells[cell_id], transaction.state).update({})
          );
        }
      }
      for (let cell_id of map.keys()) {
        if (!cell_order.includes(cell_id)) {
          mutate_map().delete(cell_id);
        }
      }
    }

    for (let effect of transaction.effects) {
      if (effect.is(FromCellTransactionEffect)) {
        let { cell_id, transaction } = effect.value;

        if (map.get(cell_id)?.state !== transaction.startState) {
          console.log(`map.get(cell_id)?.state !== transaction.startState:`, {
            map: map,
            state: map.get(cell_id)?.state,
            startState: transaction.startState,
          });
          // prettier-ignore
          throw new Error(`Updating cell state for Cell(${cell_id}) but the cell state is not the same as the transaction start state`);
        }
        mutate_map().set(cell_id, transaction);
      }
    }

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
    return map;
  },
});

export let update_cell_state = (
  nexus_state: NotebookState,
  cell_id: CellId,
  spec: TransactionSpec
) => {
  let cell_editor_states = nexus_state.field(CellEditorStatesField);
  let cell_editor_state = cell_editor_states.get(cell_id);
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
  let transactions = viewupdate.state.field(CellEditorStatesField);

  for (let [cell_id, transaction] of transactions) {
    let start_transaction = start_transactions.get(cell_id);
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
