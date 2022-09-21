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
import { compact, groupBy, zip } from "lodash";
import React from "react";
import { useRealMemo } from "use-real-memo";

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
    this.emitter.setMaxListeners(Infinity);
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
 * @param {{
 *  doc: string,
 *  extensions: Array<import("@codemirror/state").Extension>,
 *  parent_ref?: React.RefObject<HTMLElement>,
 * }} props
 */
export let useCodemirrorEditorviewWithExtensions = ({
  doc,
  extensions,
  parent_ref,
}) => {
  let initial_extensions = React.useRef(extensions).current;
  let previous_extensions_ref = React.useRef(extensions);

  if (previous_extensions_ref.current.length !== extensions.length) {
    throw new Error(
      `Can't change the amount of extensions in useCodemirrorEditorviewWithExtensions`
    );
  }

  let compartments = React.useMemo(() => {
    return extensions.map((extension) => new Compartment());
  }, []);

  // TODO Ideally I split up creating the state (in useMemo/useRef) and creating the view (in useEffect).
  // .... Because the editorview is a side-effect, and I don't want to do that in a useMemo.
  let editorstate = useRealMemo(() => {
    return EditorState.create({
      doc: doc,
      extensions: zip(compartments, initial_extensions).map(
        // @ts-ignore trust me, `compartments` and `extensions` are the same length
        ([compartment, extension]) => compartment.of(extension)
      ),
    });
  }, []);

  // TODO Stuff in useMemo, will fix later
  let editorview = useRealMemo(() => {
    return new EditorView({
      state: editorstate,
      parent: parent_ref?.current ?? undefined,
    });
  }, [editorstate]);

  // Update extensions
  React.useEffect(() => {
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
    if (reconfigures.length > 0) {
      editorview.dispatch({
        effects: reconfigures,
      });
    }
  }, [...extensions]);

  return editorview;
};

let send_to_cell_effects_to_emitter = EditorView.updateListener.of((update) => {
  let emitter = update.state.facet(NexusToCellEmitterFacet);
  let effects_to_cells = update.transactions.flatMap((transaction) =>
    transaction.effects.filter((effect) => effect.is(ToCellEffect))
  );
  let x = groupBy(effects_to_cells, (x) => x.value.cell_id);
  for (let [cell_id, effects] of Object.entries(x)) {
    emitter.emit({
      cell_id: cell_id,
      transaction_specs: effects.map((effect) => effect.value.transaction_spec),
    });
  }
});

/**
 * Creates a lone editorview that is not bound (and honestly, should not be bound) to the DOM.
 * It can be customized by adding `nexus_extension` to the cell editors.
 * Nexus extensions will have access to a couple more powers
 * - They can listen to `FromCellEffect`s, which are effects that are sent from other cells
 * - They can send `ToCellEffect`s, which are effects that are sent to other cells
 *
 * @param {Array<import("@codemirror/state").Extension>} extensions
 */
export function useCodemirrorNexus(extensions = []) {
  let emitter_facet = React.useRef(
    NexusToCellEmitterFacet.of(new SingleEventEmitter())
  ).current;
  return useCodemirrorEditorviewWithExtensions({
    doc: "",
    extensions: [
      // This is not to be used inside Nexus-extensions,
      // but to be queried by the Cell-extension so it can retrieve transactions/effects from the Nexus.
      emitter_facet,

      // Emit ToCellEffect to the emitter so the Cell-extension can pick it up
      send_to_cell_effects_to_emitter,

      ...extensions,
    ],
  });
}

export let nexus_extension = (extension) => {
  return ViewPlugin.define((view) => {
    let nexus = view.state.facet(NexusFacet);
    if (nexus == null) {
      throw new Error("Extension requires a Nexus");
    }

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
 * Utility for iterating through all the "from cell" effects in a transaction.
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

    // Transactions from the nexus are emitted to the cell specific editorview.
    // These will be dispatched verbatim, so you will mostly only use specific Effects,
    // as there isn't really a way to dispatch text changes as the nexus doesn't know all the texts. (or does it???)
    ViewPlugin.define((cell_editor_view) => {
      let nexus = cell_editor_view.state.facet(NexusFacet);
      let bus_emitter = nexus.state.facet(NexusToCellEmitterFacet);
      let off = bus_emitter.on((event) => {
        let cell_id = cell_editor_view.state.facet(CellIdFacet);
        if (cell_id === event.cell_id) {
          // console.log(`Dispatching transaction to cell:`, event);
          cell_editor_view.dispatch(...event.transaction_specs);
        }
      });
      return {
        destroy() {
          off();
        },
      };
    }),

    // This sends every single transaction that happens on cell views to the nexus view.
    // The transactions will be wrapped in a new transaction that has a FromCellEffect.
    // Not sure if this is necessary, but it makes the shared history work, for example.
    // Most of the time you'll want to create explicit "to nexus" effects anyway.
    // TODO? Not use updateListener but something more "state based"? Feels like updateListener is too coarse..
    EditorView.updateListener.of((update) => {
      let nexus = update.state.facet(NexusFacet);
      let cell_id = update.state.facet(CellIdFacet);

      if (nexus == null) {
        throw new Error("Cell extension requires a Nexus");
      }
      if (cell_id == null) {
        throw new Error("Cell extension requires a CellIdFacet");
      }

      nexus.dispatch(
        ...update.transactions.map((transaction) => {
          return {
            effects: [
              FromCellEffect.of({
                cell_id: cell_id,
                transaction: transaction,
              }),
            ],
          };
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
