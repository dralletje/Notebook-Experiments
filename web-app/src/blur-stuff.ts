/**
 * So I'm trying to find a proper way to manage selection and focus between cells...
 * I guess I'll have to put it in a shared state anyway...
 */

import { StateEffect, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { SelectedCellsField } from "./cell-selection";
import {
  CellDispatchEffect,
  CellEditorStatesField,
  CellPlugin,
} from "./NotebookEditor";

let BlurEffect = StateEffect.define<void>();

let blur_effect_listener = CellPlugin.of(
  EditorView.updateListener.of((viewupdate) => {
    for (let transaction of viewupdate.transactions) {
      for (let effect of transaction.effects) {
        if (effect.is(BlurEffect)) {
          console.log("BLUR");
          viewupdate.view.contentDOM.blur();
        }
      }
    }
  })
);
let blur_cells_when_selecting = EditorState.transactionExtender.of(
  (transaction) => {
    if (
      transaction.startState.field(SelectedCellsField) != null &&
      transaction.state.field(SelectedCellsField, false) == null
    ) {
      // This happens when hot reloading, this extension hasn't reloaded yet, but
      // the next version of `SelectedCellsFacet` has replaced the old.
      // Thus, we are looking for the old version of `SelectedCellsFacet` on the new state,
      // which doesn't exist!!
      return null;
    }
    if (
      transaction.startState.field(SelectedCellsField) !==
        transaction.state.field(SelectedCellsField) &&
      transaction.state.field(SelectedCellsField).length > 0
    ) {
      let notebook = transaction.state.field(CellEditorStatesField);
      return {
        effects: notebook.cell_order.map((cell_id) =>
          CellDispatchEffect.of({
            cell_id: cell_id,
            transaction: { effects: BlurEffect.of() },
          })
        ),
      };
    }
    return null;
  }
);

/**
 * Tiny extension that will put the editor in focus whenever any transaction comes with `scrollIntoView` effect.
 * For example, history uses this. Normally, this doesn't focus the editor, because it is assumed the editor is already in focus.
 * Well guess what, on notebooks it ain't!
 */
let focus_on_scrollIntoView = EditorView.updateListener.of((update) => {
  if (update.transactions.some((tx) => tx.scrollIntoView)) {
    console.log(`FOCUS`);
    update.view.focus();
  }
});

export let blur_stuff = [
  // blur_effect_listener,
  // blur_cells_when_selecting,
  // CellPlugin.of(focus_on_scrollIntoView),
];
