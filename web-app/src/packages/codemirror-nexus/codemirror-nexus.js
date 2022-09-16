import EventEmitter from "events";
import {
  ChangeSet,
  Compartment,
  EditorState,
  Facet,
  Prec,
  StateEffect,
  StateEffectType,
  Transaction,
} from "@codemirror/state";
import {
  EditorView,
  runScopeHandlers,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { groupBy } from "lodash";

/**
 * @typedef CellId
 * @type {string}
 */

/** @type {Facet<string, string>} */
export let CellIdFacet = Facet.define({
  combine: (x) => x[0],
});

/**
 * @typedef ToCellEmitter
 * @type {SingleEventEmitter<{ cell_id: CellId, transaction_specs: Array<import("@codemirror/state").TransactionSpec> }>}
 */

/**
 * @type {Facet<ToCellEmitter, ToCellEmitter>} */
export let NexusToCellEmitterFacet = Facet.define({
  combine: (x) => x[0],
});

/** @type {Facet<CellId[], CellId[]>} */
export let CellIdOrder = Facet.define({
  combine: (x) => x[0],
});

/** @type {Facet<EditorView, EditorView>} */
export let NexusFacet = Facet.define({
  combine: (x) => x[0],
});

/** @type {StateEffectType<{ cell_id: CellId, transaction: Transaction }>} */
export let FromCellEffect = StateEffect.define({});
/** @type {StateEffectType<{ cell_id: CellId, transaction_spec: import("@codemirror/state").TransactionSpec }>} */
export let ToCellEffect = StateEffect.define({});

/**
 * @template T
 */
class SingleEventEmitter {
  constructor() {
    this.emitter = new EventEmitter();
  }
  /**
   * @param {(value: T) => void} listener
   * @returns {() => void}
   */
  on(listener) {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.removeListener("event", listener);
    };
  }

  /**
   * @param {(value: T) => void} listener
   * @returns {void}
   */
  off(listener) {
    this.emitter.removeListener("event", listener);
  }

  /**
   * @param {T} value
   * @returns {void}
   */
  emit(value) {
    this.emitter.emit("event", value);
  }
}

/**
 * Creates a lone editorview that is not bound (and honestly, should not be bound) to the DOM.
 * It can be customized by adding `nexus_extension` to the cell editors.
 * Nexus extensions will have access to a couple more powers
 * - They can listen to `FromCellEffect`s, which are effects that are sent from other cells
 * - They can send `ToCellEffect`s, which are effects that are sent to other cells
 * - They can query the `CellIdOrder` facet, which is a list of all the cell ids in order
 *
 * @param {import("@codemirror/state").Extension} extensions
 */
export function codemirror_nexus(extensions = []) {
  return new EditorView({
    state: EditorState.create({
      doc: "",
      extensions: [
        // This is not to be used inside Nexus-extensions,
        // but to be queried the Cell-extension so it can retrieve transactions/effects from the Nexus.
        NexusToCellEmitterFacet.of(new SingleEventEmitter()),

        // Emit ToCellEffect to the emitter so the Cell-extension can pick it up
        EditorView.updateListener.of((update) => {
          let emitter = update.state.facet(NexusToCellEmitterFacet);
          let effects_to_cells = update.transactions.flatMap((transaction) =>
            transaction.effects.filter((effect) => effect.is(ToCellEffect))
          );
          let x = groupBy(effects_to_cells, (x) => x.value.cell_id);
          for (let [cell_id, effects] of Object.entries(x)) {
            emitter.emit({
              cell_id: cell_id,
              transaction_specs: effects.map(
                (effect) => effect.value.transaction_spec
              ),
            });
          }
        }),

        extensions,
      ],
    }),
  });
}

export let nexus_extension = (extension) => {
  return ViewPlugin.define((view) => {
    let nexus = view.state.facet(NexusFacet);
    let compartment = new Compartment();

    nexus.dispatch({
      effects: StateEffect.appendConfig.of(compartment.of(extension)),
    });
    return {
      destroy() {
        nexus.dispatch({
          // @ts-ignore
          effects: compartment.reconfigure(null),
        });
      },
    };
  });
};

/**
 * @param {ViewUpdate | Transaction} update_or_transaction
 * @returns {Array<StateEffect<{ cell_id: CellId, transaction: Transaction }>>}
 */
export let from_cell_effects = (update_or_transaction) => {
  if (update_or_transaction instanceof Transaction) {
    return update_or_transaction.effects.filter((effect) =>
      effect.is(FromCellEffect)
    );
  } else {
    return update_or_transaction.transactions.flatMap((transaction) =>
      transaction.effects.filter((effect) => effect.is(FromCellEffect))
    );
  }
};

/**
 * @param {EditorView} _nexus
 */
export let child_extension = (_nexus) => {
  return [
    NexusFacet.of(_nexus),

    // Changes from the nexus are emitted to the cell specific editorview
    ViewPlugin.define((cell_editor_view) => {
      let nexus = cell_editor_view.state.facet(NexusFacet);
      let bus_emitter = nexus.state.facet(NexusToCellEmitterFacet);
      let off = bus_emitter.on((event) => {
        let cell_id = cell_editor_view.state.facet(CellIdFacet);
        if (cell_id === event.cell_id) {
          console.log(`Dispatching transaction to cell:`, event);
          cell_editor_view.dispatch(...event.transaction_specs);
        }
      });
      return {
        destroy() {
          off();
        },
      };
    }),

    // On update, send transactions as an effect to the nexus state
    EditorView.updateListener.of((update) => {
      let nexus = update.state.facet(NexusFacet);
      let cell_id = update.state.facet(CellIdFacet);

      if (cell_id == null) {
        console.warn(`Cell id is null in update listener`);
        return;
      }

      nexus.dispatch(
        ...update.transactions.map((transaction) => {
          return /** @type {import("@codemirror/state").TransactionSpec} */ ({
            // @ts-ignore
            annotations: transaction.annotations,
            // This fixes isAdjacent (https://github.com/codemirror/history/blob/3c41743067bc405faa0b9cbe0c81ef1e6f7cd627/src/history.ts#L320)
            // but I should just clone history into here and actually change the code
            changes: transaction.changes.empty
              ? ChangeSet.empty
              : { from: 0, to: 0, insert: "a" },
            effects: [
              FromCellEffect.of({
                cell_id: cell_id,
                transaction: transaction,
              }),
            ],
          });
        })
      );
    }),

    // Pass through keydown events to the nexus editor view so
    // commands can be defined there.
    // Putting it as `Prec.lowest` because the BUS keyhandlers can't do cell-specific stuff,
    // this I think they are generally the very very last thing to run.
    // Should only really be used for global commands.
    Prec.lowest(
      EditorView.domEventHandlers({
        keydown(event, cell_editor_view) {
          // Only keydown events that aren't already handled by other domEventHandlers
          // or handled by other keymaps, will end up here... which is amazing! Thanks codemirror!!!
          let nexus = cell_editor_view.state.facet(NexusFacet);
          return runScopeHandlers(nexus, event, "editor");
        },
      })
    ),
  ];
};
