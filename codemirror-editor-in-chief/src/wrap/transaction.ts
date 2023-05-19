import {
  Annotation,
  AnnotationType,
  StateEffect,
  Transaction,
} from "@codemirror/state";
import { ModernMap } from "@dral/modern-map";
import { EditorInChief } from "../editor-in-chief-state";
import { EditorId, EditorIdFacet, EditorsField } from "../logic";
import { EditorInChiefChangeSet } from "./changes";

export type EditorInChiefTransactionSpec = {
  annotations?: Annotation<any> | readonly Annotation<any>[];
  effects?: StateEffect<any> | readonly StateEffect<any>[];

  userEvent?: string;
  filter?: boolean;
  scrollIntoView?: boolean;
};
export class EditorInChiefTransaction {
  state: EditorInChief;

  constructor(
    public startState: EditorInChief,
    public transaction: Transaction
  ) {
    this.transaction = transaction;
    this.state = new EditorInChief(this.transaction.state);
  }

  annotation<T>(type: AnnotationType<T>): T | undefined {
    return this.transaction.annotation(type);
  }
  get annotations(): readonly Annotation<any>[] {
    // @ts-ignore
    return this.transaction.annotations;
  }

  get effects() {
    return this.transaction.effects;
  }
  get changes(): EditorInChiefChangeSet {
    return new EditorInChiefChangeSet(
      this.cell_transactions.mapValues((transactions) => {
        return transactions
          .map((x) => x.changes)
          .reduce((acc, x) => acc.compose(x));
      })
    );
  }

  get _transactions() {
    return this.state.field(EditorsField).transactions_to_send_to_cells;
  }

  private get cell_transactions() {
    let cell_changes: ModernMap<EditorId, Transaction[]> = new ModernMap();

    for (let transaction of this._transactions) {
      let cell_id = transaction.state.facet(EditorIdFacet);
      cell_changes.emplace(cell_id, {
        insert: (key) => [transaction],
        update: (value) => [...value, transaction],
      });
    }

    return cell_changes;
  }
}
