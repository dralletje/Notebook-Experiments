import { Transaction } from "@codemirror/state";
import ManyKeysWeakmap from "./many-keys-map";
import { EditorIdFacet, EditorInChief, EditorsField } from "./editor-in-chief";
import { EditorDispatchEffect, EditorId } from "./logic";

import type {
  BareEditorState,
  EditorKeyOf,
  EditorMapping,
} from "./editor-in-chief-state";
import { GenericViewUpdate } from "codemirror-x-react/viewupdate.js";
import { EditorInChiefTransactionSpec } from "./wrap/transaction";

let weakmap_get_or_create = <T extends Object, U>({
  weakmap,
  key,
  create,
}: {
  weakmap: WeakMap<T, U>;
  key: T;
  create: (key: T) => U;
}): U => {
  let value = weakmap.get(key);
  if (value === undefined) {
    value = create(key);
    weakmap.set(key, value);
  }
  return value;
};

let nested_dispatch_weakmap = new ManyKeysWeakmap<
  [Object, number],
  (...transactions: import("@codemirror/state").TransactionSpec[]) => void
>();
let nested_editorstate_weakmap = new ManyKeysWeakmap<
  [Object, number],
  BareEditorState
>();
let nested_transactions_weakmap = new ManyKeysWeakmap<
  [Object, number],
  Transaction[]
>();
let nested_viewupdate_weakmap = new ManyKeysWeakmap<
  [Object, Object, Object],
  GenericViewUpdate<BareEditorState>
>();

export let extract_nested_viewupdate = <
  T extends EditorMapping,
  K extends EditorKeyOf<T>
>(
  viewupdate: GenericViewUpdate<EditorInChief<T>>,
  editor_id: EditorId<K>
): GenericViewUpdate<T[K]> => {
  // Wrap every transaction in EditorDispatchEffect's
  let nested_dispatch = weakmap_get_or_create({
    weakmap: nested_dispatch_weakmap,
    key: [viewupdate.view.dispatch, editor_id],
    create: () => {
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
  });

  let nested_editor_state = weakmap_get_or_create({
    weakmap: nested_editorstate_weakmap,
    key: [viewupdate.state, editor_id],
    // Can't use `.editor(...)` here because I want to it to silently fail if the editor doesn't exist.
    // (Why do I want this to silently fail?!)
    create: () => viewupdate.state.field(EditorsField).cells[editor_id],
  });

  let nested_transactions = weakmap_get_or_create({
    weakmap: nested_transactions_weakmap,
    key: [viewupdate.transactions, editor_id],
    create: () => {
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
  });

  let nested_viewupdate = weakmap_get_or_create({
    weakmap: nested_viewupdate_weakmap,
    key: [nested_transactions, nested_editor_state, nested_dispatch],
    create: () => {
      return new GenericViewUpdate(nested_transactions, {
        state: nested_editor_state,
        dispatch: nested_dispatch,
      });
    },
  });
  return nested_viewupdate;
};
