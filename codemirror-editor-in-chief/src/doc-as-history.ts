// EXPERIMENTAL
// Express doc changes just like any other effect

import { invertedEffects } from "@codemirror/commands";
import {
  ChangeSet,
  EditorState,
  StateEffect,
  TransactionSpec,
} from "@codemirror/state";

export let DocChangedEffect = StateEffect.define<ChangeSet>();
let effect_for_doc = EditorState.transactionExtender.of((transaction) => {
  if (transaction.docChanged) {
    console.log("EXTENDER");
    return {
      effects: [DocChangedEffect.of(transaction.changes)],
    };
  } else {
    return null;
  }
});
let inverted_doc = invertedEffects.of((tr) => {
  let effects = [];
  for (let effect of tr.effects) {
    if (effect.is(DocChangedEffect)) {
      console.log("INVERTED");
      effects.push(DocChangedEffect.of(effect.value.invert(tr.startState.doc)));
    }
  }
  return effects;
});
let apply_doc_effect = EditorState.transactionFilter.of((transaction) => {
  // return transaction;

  let _transactions: TransactionSpec | TransactionSpec[] = transaction;
  for (let effect of transaction.effects) {
    if (effect.is(DocChangedEffect)) {
      let next_transaction: TransactionSpec = { changes: effect.value };
      console.log(`next_transaction:`, next_transaction);
      if (Array.isArray(_transactions)) {
        _transactions = [..._transactions, next_transaction];
      } else {
        _transactions = [_transactions, next_transaction];
      }
    }
  }

  return _transactions;
});

export let doc_as_history = [effect_for_doc, inverted_doc, apply_doc_effect];
