import React from "react";
import { takeWhile, without } from "lodash-es";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { CodeMirror } from "./codemirror-x-react.js";

/**
 * @typedef NotebookState
 * @type {import("@codemirror/state").EditorState}
 *
 * @typedef GenericEditorView
 * @type {{
 *  state: NotebookState;
 *  dispatch: (...tr: import("@codemirror/state").TransactionSpec[]) => void;
 * }}
 */

export class GenericViewUpdate {
  constructor(
    /** @type {Transaction[]} */ transactions,
    /** @type {GenericEditorView} */ view
  ) {
    // TODO Check if the transactions are actually in order?
    this.transactions = transactions;
    this.view = view;
  }
  get state() {
    return this.view.state;
  }
  get startState() {
    return this.transactions[0]?.startState ?? this.view.state;
  }
}

// TODO This now only looks at the transactions linearly, might want to
// .... add the ability to find "rogue" transactions that deviated (and should be removed)
let find_transactions_to_apply = (
  /** @type {Transaction[]} */ transactions,
  /** @type {EditorState} */ state
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
 * @param {EditorState} state
 * @param {(state: EditorState) => void} on_change
 */
export let useViewUpdate = (state, on_change) => {
  // I feel dirty for using a ref STILL, after all my hard work to get rid of them.
  let transactions_to_apply_ref = React.useRef(
    /** @type {Transaction[]} */ ([])
  );
  // But now I do use refs, I'll fuckin' use them
  let current_state = React.useRef(state);
  current_state.current = state;

  // Hope that the way I use with refs and all (and not useState) is not a problem?
  let notebook_dispatch = React.useCallback(
    (
      /** @type {import("@codemirror/state").TransactionSpec[]} */ ...transaction_specs
    ) => {
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
    return new GenericViewUpdate(transactions_to_apply_now, {
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
    }
  }, [viewupdate, transactions_to_apply_ref]);

  return viewupdate;
};

export let CodemirrorFromViewUpdate = React.forwardRef(
  (
    /** @type {{ viewupdate: GenericViewUpdate, children: React.ReactNode } & import("react").HtmlHTMLAttributes<"div">} */ {
      viewupdate,
      children,
      ...props
    },
    /** @type {import("react").ForwardedRef<EditorView>} */ _ref
  ) => {
    let initial_editor_state = React.useMemo(() => {
      return viewupdate.startState;
    }, []);

    // prettier-ignore
    let editorview_ref = React.useRef(/** @type {EditorView} */ (/** @type {any} */ (null)));
    React.useImperativeHandle(_ref, () => editorview_ref.current);

    // prettier-ignore
    let last_viewupdate_ref = React.useRef(/** @type {GenericViewUpdate} */ (/** @type {any} */ (null)));
    React.useLayoutEffect(() => {
      // Make sure we don't update from the same viewupdate twice
      if (last_viewupdate_ref.current === viewupdate) {
        return;
      }
      last_viewupdate_ref.current = viewupdate;

      if (viewupdate.transactions.length > 0) {
        if (viewupdate.startState !== editorview_ref.current.state) {
          // TODO Now just warning, might need to `.setState`?
          console.warn(`ViewUpdate is not in sync with the EditorView`);
          console.log(`viewupdate.state:`, viewupdate);
          editorview_ref.current.setState(viewupdate.state);
          // editorview_ref.current.update(viewupdate.transactions);
        } else {
          editorview_ref.current.update(viewupdate.transactions);
        }
      }
    }, [viewupdate]);

    // return (
    //   <CodeMirror
    //     state={initial_editor_state}
    //     ref={editorview_ref}
    //     dispatch={(transactions, editorview) => {
    //       viewupdate.view.dispatch(...transactions);
    //     }}
    //   >
    //     {children}
    //   </CodeMirror>
    // );
    // The above but without jsx:
    return React.createElement(
      CodeMirror,
      {
        state: initial_editor_state,
        ref: editorview_ref,
        dispatch: (transactions, editorview) => {
          viewupdate.view.dispatch(...transactions);
        },
        ...props,
      },
      children
    );
  }
);
