import { Transaction } from "@codemirror/state";
import { compositeKey, CompositeKey } from "composite-key";
import { EditorIdFacet, EditorInChief, EditorsField } from "./editor-in-chief";
import { EditorDispatchEffect, EditorId } from "./logic";
import { ModernWeakMap } from "@dral/modern-map";

import type {
  BareEditorState,
  EditorKeyOf,
  EditorMapping,
} from "./editor-in-chief-state";
import { GenericViewUpdate } from "codemirror-x-react/viewupdate.js";
import {
  EditorInChiefTransaction,
  EditorInChiefTransactionSpec,
} from "./wrap/transaction";

type DispatchFunction = any;

let nested_dispatch_weakmap = new ModernWeakMap<
  CompositeKey<[DispatchFunction, EditorId]>,
  (...transactions: import("@codemirror/state").TransactionSpec[]) => void
>();
let nested_editorstate_weakmap = new ModernWeakMap<
  CompositeKey<[EditorInChief, EditorId]>,
  BareEditorState
>();
let nested_transactions_weakmap = new ModernWeakMap<
  CompositeKey<[EditorInChiefTransaction<EditorInChief>[], EditorId]>,
  Transaction[]
>();
let nested_viewupdate_weakmap = new ModernWeakMap<
  CompositeKey<[Transaction[], BareEditorState, DispatchFunction]>,
  GenericViewUpdate<any>
>();

export let extract_nested_viewupdate = <
  T extends EditorMapping,
  K extends EditorKeyOf<T>
>(
  viewupdate: GenericViewUpdate<EditorInChief<T>>,
  editor_id: EditorId<K>
): GenericViewUpdate<T[K]> => {
  let x = compositeKey(viewupdate.view.dispatch, editor_id);
  // Wrap every transaction in EditorDispatchEffect's
  let nested_dispatch = nested_dispatch_weakmap.emplace(
    compositeKey(viewupdate.view.dispatch, editor_id),
    {
      insert: () => {
        return (...transactions: EditorInChiefTransactionSpec[]) => {
          viewupdate.view.dispatch(
            ...transactions.map((tr) => ({
              annotations: tr.annotations,
              effects: EditorDispatchEffect.of({
                editor_id: editor_id,
                transaction: tr,
              }),
            }))
          );
        };
      },
    }
  );

  let nested_editor_state = nested_editorstate_weakmap.emplace(
    compositeKey(viewupdate.state, editor_id),
    {
      insert: () => viewupdate.state.editor(editor_id, false),
    }
  );

  let nested_transactions = nested_transactions_weakmap.emplace(
    compositeKey(viewupdate.transactions, editor_id),
    {
      insert: () => {
        // Because we get one `viewupdate` for multiple transactions happening,
        // and `.transactions_to_send_to_cells` gets cleared after every transactions,
        // we have to go over all the transactions in the `viewupdate` and collect `.transactions_to_send_to_cells`s.
        let all_cell_transactions = viewupdate.transactions.flatMap(
          (transaction) => {
            return transaction.state.field(EditorsField)
              .transactions_to_send_to_cells;
          }
        );
        return all_cell_transactions.filter((transaction) => {
          return transaction.startState.facet(EditorIdFacet) === editor_id;
        });
      },
    }
  );

  let nested_viewupdate = nested_viewupdate_weakmap.emplace(
    compositeKey(nested_transactions, nested_editor_state, nested_dispatch),
    {
      insert: () => {
        return new GenericViewUpdate(nested_transactions, {
          state: nested_editor_state,
          dispatch: nested_dispatch,
        });
      },
    }
  );
  return nested_viewupdate;
};
