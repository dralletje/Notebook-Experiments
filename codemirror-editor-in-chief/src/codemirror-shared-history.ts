// Adapted from https://github.com/codemirror/commands/blob/203778f6094f114d488235583bdf95b2bb85642c/src/history.ts
// but made to work at a nexus. So it will be a history of all cells connected to the nexus.
// Selection stuff doesn't work yet, I think...
// But the rest does!! WHATTTT

// Thinking about putting the selection stuff completely separate from the history stuff,
// should still be mapped through transactions obviously, but not stored in/next to the history.

import {
  combineConfig,
  EditorState,
  Transaction,
  StateEffect,
  Facet,
  Annotation,
  ChangeDesc,
} from "@codemirror/state";

import {
  isolateHistory,
  invertedEffects as editor_invertedEffects,
} from "@codemirror/commands";
export { isolateHistory };

import {
  EditorDispatchEffect,
  EditorIdFacet,
  EditorInChiefTransaction,
  EditorInChief,
  EditorAddEffect,
  EditorRemoveEffect,
  EditorHasSelectionField,
} from "./editor-in-chief";
import { compact } from "lodash";
import { EditorInChiefSelection, CellStateEffect } from "./wrap-cell-types";
import { EditorInChiefCommand, EditorInChiefKeyBinding } from "./wrap/keymap";
import {
  EditorInChiefChangeDesc,
  EditorInChiefChangeSet,
} from "./wrap/changes";
import { EditorInChiefStateField } from "./wrap/statefield";
import { EditorInChiefExtension } from "./wrap/extension";

export const invertedEffects = Facet.define<
  (tr: EditorInChiefTransaction) => readonly StateEffect<any>[],
  readonly ((tr: EditorInChiefTransaction) => readonly StateEffect<any>[])[]
>();

const enum BranchName {
  Done,
  Undone,
}

const fromHistory = Annotation.define<{ side: BranchName; rest: Branch }>();

interface HistoryConfig {
  /// The minimum depth (amount of events) to store. Defaults to 100.
  minDepth?: number;
  /// The maximum time (in milliseconds) that adjacent events can be
  /// apart and still be grouped together. Defaults to 500.
  newGroupDelay?: number;
}

const historyConfig = Facet.define<HistoryConfig, Required<HistoryConfig>>({
  combine(configs) {
    return combineConfig(
      configs,
      {
        minDepth: 100,
        newGroupDelay: 500,
      },
      { minDepth: Math.max, newGroupDelay: Math.min }
    );
  },
});

function changeEnd(changes: ChangeDesc) {
  let end = 0;
  changes.iterChangedRanges((_, from, to) => (end = to));
  return end;
}

const historyField_ = EditorInChiefStateField.define<HistoryState>({
  create() {
    return HistoryState.empty;
  },

  update(state: HistoryState, tr: EditorInChiefTransaction): HistoryState {
    let config = tr.state.facet(historyConfig);

    let fromHist = tr.annotation(fromHistory);
    if (fromHist) {
      // TODO
      // let selection = tr.docChanged
      //   ? EditorSelection.single(changeEnd(tr.changes))
      //   : undefined;
      let selection = undefined;
      let item = CellHistEvent.fromTransaction(tr, selection),
        from = fromHist.side;
      let other = from == BranchName.Done ? state.undone : state.done;
      if (item)
        other = updateBranch(other, other.length, config.minDepth, item);
      else other = addSelection(other, tr.startState.selection);
      return new HistoryState(
        from == BranchName.Done ? fromHist.rest : other,
        from == BranchName.Done ? other : fromHist.rest
      );
    }

    let isolate = tr.annotation(isolateHistory);
    if (isolate == "full" || isolate == "before") state = state.isolate();

    if (tr.annotation(Transaction.addToHistory) === false)
      return !tr.changes.empty ? state.addMapping(tr.changes.desc) : state;

    let event = CellHistEvent.fromTransaction(tr);
    let time = tr.annotation(Transaction.time)!,
      userEvent = tr.annotation(Transaction.userEvent);
    if (event)
      state = state.addChanges(
        event,
        time,
        userEvent,
        config.newGroupDelay,
        config.minDepth
      );
    // TODO
    else if (tr.transaction.selection)
      state = state.addSelection(
        tr.startState.selection,
        time,
        userEvent,
        config.newGroupDelay
      );

    if (isolate == "full" || isolate == "after") state = state.isolate();
    return state;
  },

  toJSON(value) {
    return {
      done: value.done.map((e) => e.toJSON()),
      undone: value.undone.map((e) => e.toJSON()),
    };
  },

  fromJSON(json) {
    return new HistoryState(
      json.done.map(CellHistEvent.fromJSON),
      json.undone.map(CellHistEvent.fromJSON)
    );
  },
});

/// Create a history extension with the given configuration.
export function shared_history(
  config: HistoryConfig = {}
): EditorInChiefExtension {
  return [
    historyField_,
    historyConfig.of(config),
    // TODO EditorInChief.domEventHandlers?
    // EditorView.domEventHandlers({
    //   beforeinput(e, view) {
    //     let command =
    //       e.inputType == "historyUndo"
    //         ? undo
    //         : e.inputType == "historyRedo"
    //         ? redo
    //         : null;
    //     if (!command) return false;
    //     e.preventDefault();
    //     return command(view);
    //   },
    // }),
    // DRAL
    inverted_add_remove_editor,
  ];
}

/// The state field used to store the history data. Should probably
/// only be used when you want to
/// [serialize](#state.EditorState.toJSON) or
/// [deserialize](#state.EditorState^fromJSON) state objects in a way
/// that preserves history.
export const historyField = historyField_ as EditorInChiefStateField<unknown>;

function cmd(side: BranchName, selection: boolean): EditorInChiefCommand<any> {
  return function ({ state, dispatch }) {
    // TODO FIgure out selection & check readOnly on sub editors?
    // if (!selection && state.readOnly) return false;
    let historyState = state.field(historyField_, false);
    if (!historyState) return false;
    let tr = historyState.pop(side, state, selection);
    if (!tr) return false;
    dispatch(tr);
    return true;
  };
}

/// Undo a single group of history events. Returns false if no group
/// was available.
export const undo = cmd(BranchName.Done, false);
/// Redo a group of history events. Returns false if no group was
/// available.
export const redo = cmd(BranchName.Undone, false);

/// Undo a change or selection change.
export const undoSelection = cmd(BranchName.Done, true);

/// Redo a change or selection change.
export const redoSelection = cmd(BranchName.Undone, true);

// History events store groups of changes or effects that need to be
// undone/redone together.
class CellHistEvent {
  constructor(
    // The changes in this event. Normal events hold at least one
    // change or effect. But it may be necessary to store selection
    // events before the first change, in which case a special type of
    // instance is created which doesn't hold any changes, with
    // changes == startSelection == undefined
    readonly changes: EditorInChiefChangeSet | undefined,
    // The effects associated with this event
    readonly effects: readonly CellStateEffect<any>[],
    // Accumulated mapping (from addToHistory==false) that should be
    // applied to events below this one.
    readonly mapped: EditorInChiefChangeDesc | undefined,
    // The selection before this event
    readonly startSelection: EditorInChiefSelection | undefined,
    // Stores selection changes after this event, to be used for
    // selection undo/redo.
    readonly selectionsAfter: readonly EditorInChiefSelection[]
  ) {}

  setSelAfter(after: readonly EditorInChiefSelection[]) {
    return new CellHistEvent(
      this.changes,
      this.effects,
      this.mapped,
      this.startSelection,
      after
    );
  }

  toJSON() {
    return {
      changes: this.changes?.toJSON(),
      mapped: this.mapped?.toJSON(),
      // startSelection: this.startSelection?.toJSON(),
      // selectionsAfter: this.selectionsAfter.map((s) => s.toJSON()),
    };
  }

  static fromJSON(json: any) {
    return new CellHistEvent(
      json.changes && EditorInChiefChangeSet.fromJSON(json.changes),
      [],
      json.mapped && EditorInChiefChangeSet.fromJSON(json.mapped),
      // TODO
      null,
      null
      // json.startSelection && EditorInChiefSelection.fromJSON(json.startSelection),
      // json.selectionsAfter.map(EditorInChiefSelection.fromJSON)
    );
  }

  // This does not check `addToHistory` and such, it assumes the
  // transaction needs to be converted to an item. Returns null when
  // there are no changes or effects in the transaction.
  // DRAL CHANGES:
  // - Goes through the inverted changes for the main transaction,
  //   but also asks every cell for it's possible inverted changes.
  static fromTransaction(
    editor_in_chief_transaction: EditorInChiefTransaction,
    selection?: EditorInChiefSelection
  ) {
    let effects: readonly CellStateEffect<any>[] = none;

    let transactions_to_send_to_cells =
      editor_in_chief_transaction._transactions;

    for (let invert of editor_in_chief_transaction.startState.facet(
      invertedEffects
    )) {
      let result = invert(editor_in_chief_transaction).map(
        (x) => new CellStateEffect(null, x)
      );
      if (result.length) effects = effects.concat(result);
    }
    for (let transaction of transactions_to_send_to_cells) {
      let cell_id = transaction.state.facet(EditorIdFacet);
      for (let invert of transaction.startState.facet(editor_invertedEffects)) {
        let result = invert(transaction).map(
          (x) => new CellStateEffect(cell_id, x)
        );
        if (result.length) effects = effects.concat(result);
      }
    }

    if (!effects.length && editor_in_chief_transaction.changes.empty)
      return null;
    return new CellHistEvent(
      editor_in_chief_transaction.changes.invert(
        editor_in_chief_transaction.startState.doc
      ),
      effects,
      undefined,
      selection || editor_in_chief_transaction.startState.selection,
      none
    );
  }

  static selection(selections: readonly EditorInChiefSelection[]) {
    return new CellHistEvent(undefined, none, undefined, undefined, selections);
  }
}

type Branch = readonly CellHistEvent[];

function updateBranch(
  branch: Branch,
  to: number,
  maxLen: number,
  newEvent: CellHistEvent
) {
  let start = to + 1 > maxLen + 20 ? to - maxLen - 1 : 0;
  let newBranch = branch.slice(start, to);
  newBranch.push(newEvent);
  return newBranch;
}

function isAdjacent(
  a: EditorInChiefChangeDesc,
  b: EditorInChiefChangeDesc
): boolean {
  let ranges: number[] = [],
    cells: (string | null)[] = [],
    isAdjacent = false;
  a.iterChangedRanges((cell_id, f, t, _f, _t) => {
    ranges.push(f, t);
    cells.push(cell_id);
  });
  b.iterChangedRanges((cell_id, _f, _t, f, t) => {
    for (let i = 0; i < ranges.length; ) {
      let _cell_id = cells[i / 2],
        from = ranges[i++],
        to = ranges[i++];
      if (_cell_id === cell_id && t >= from && f <= to) isAdjacent = true;
    }
  });
  return isAdjacent;
}

function eqSelectionShape(
  selection_a: EditorInChiefSelection,
  selection_b: EditorInChiefSelection
) {
  return (
    selection_a.ranges.length == selection_b.ranges.length &&
    selection_a.ranges.filter((r, i) => r.empty != selection_b.ranges[i].empty)
      .length === 0
  );
}

function conc<T>(a: readonly T[], b: readonly T[]) {
  return !a.length ? b : !b.length ? a : a.concat(b);
}

const none: readonly any[] = [];

const MaxSelectionsPerEvent = 200;

function addSelection(branch: Branch, selection: EditorInChiefSelection) {
  if (!branch.length) {
    return [CellHistEvent.selection([selection])];
  } else {
    let lastEvent = branch[branch.length - 1];
    let sels = lastEvent.selectionsAfter.slice(
      Math.max(0, lastEvent.selectionsAfter.length - MaxSelectionsPerEvent)
    );
    if (sels.length && sels[sels.length - 1].eq(selection)) return branch;
    sels.push(selection);
    return updateBranch(
      branch,
      branch.length - 1,
      1e9,
      lastEvent.setSelAfter(sels)
    );
  }
}

// Assumes the top item has one or more selectionAfter values
function popSelection(branch: Branch): Branch {
  let last = branch[branch.length - 1];
  let newBranch = branch.slice();
  newBranch[branch.length - 1] = last.setSelAfter(
    last.selectionsAfter.slice(0, last.selectionsAfter.length - 1)
  );
  return newBranch;
}

// Add a mapping to the top event in the given branch. If this maps
// away all the changes and effects in that item, drop it and
// propagate the mapping to the next item.
function addMappingToBranch(branch: Branch, mapping: EditorInChiefChangeDesc) {
  if (!branch.length) return branch;
  let length = branch.length,
    selections = none;
  while (length) {
    let event = mapEvent(branch[length - 1], mapping, selections);
    if ((event.changes && !event.changes.empty) || event.effects.length) {
      // Event survived mapping
      let result = branch.slice(0, length);
      result[length - 1] = event;
      return result;
    } else {
      // Drop this event, since there's no changes or effects left
      mapping = event.mapped!;
      length--;
      selections = event.selectionsAfter;
    }
  }
  return selections.length ? [CellHistEvent.selection(selections)] : none;
}

function mapEvent(
  event: CellHistEvent,
  mapping: EditorInChiefChangeDesc,
  extraSelections: readonly EditorInChiefSelection[]
) {
  let selections = conc(
    event.selectionsAfter.length
      ? event.selectionsAfter.map((s) => s.map(mapping))
      : none,
    extraSelections
  );
  // Change-less events don't store mappings (they are always the last event in a branch)
  if (!event.changes) return CellHistEvent.selection(selections);

  let mappedChanges = event.changes.map(mapping),
    before = mapping.mapDesc(event.changes, true);
  let fullMapping = event.mapped ? event.mapped.composeDesc(before) : before;
  return new CellHistEvent(
    mappedChanges,
    CellStateEffect.mapEffects(event.effects, mapping),
    fullMapping,
    event.startSelection!.map(before),
    selections
  );
}

const joinableUserEvent = /^(input\.type|delete)($|\.)/;

class HistoryState {
  constructor(
    public readonly done: Branch,
    public readonly undone: Branch,
    private readonly prevTime: number = 0,
    private readonly prevUserEvent: string | undefined = undefined
  ) {}

  isolate() {
    return this.prevTime ? new HistoryState(this.done, this.undone) : this;
  }

  addChanges(
    event: CellHistEvent,
    time: number,
    userEvent: string | undefined,
    newGroupDelay: number,
    maxLen: number
  ): HistoryState {
    let done = this.done,
      lastEvent = done[done.length - 1];
    if (
      lastEvent &&
      lastEvent.changes &&
      !lastEvent.changes.empty &&
      event.changes &&
      (!userEvent || joinableUserEvent.test(userEvent)) &&
      ((!lastEvent.selectionsAfter.length &&
        time - this.prevTime < newGroupDelay &&
        isAdjacent(lastEvent.changes, event.changes)) ||
        // For compose (but not compose.start) events, always join with previous event
        userEvent == "input.type.compose")
    ) {
      done = updateBranch(
        done,
        done.length - 1,
        maxLen,
        new CellHistEvent(
          event.changes.compose(lastEvent.changes),
          conc(event.effects, lastEvent.effects),
          lastEvent.mapped,
          lastEvent.startSelection,
          none
        )
      );
    } else {
      done = updateBranch(done, done.length, maxLen, event);
    }
    return new HistoryState(done, none, time, userEvent);
  }

  addSelection(
    selection: EditorInChiefSelection,
    time: number,
    userEvent: string | undefined,
    newGroupDelay: number
  ) {
    let last = this.done.length
      ? this.done[this.done.length - 1].selectionsAfter
      : none;
    if (
      last.length > 0 &&
      time - this.prevTime < newGroupDelay &&
      userEvent == this.prevUserEvent &&
      userEvent &&
      /^select($|\.)/.test(userEvent) &&
      eqSelectionShape(last[last.length - 1], selection)
    )
      return this;
    return new HistoryState(
      addSelection(this.done, selection),
      this.undone,
      time,
      userEvent
    );
  }

  addMapping(mapping: EditorInChiefChangeDesc): HistoryState {
    return new HistoryState(
      addMappingToBranch(this.done, mapping),
      addMappingToBranch(this.undone, mapping),
      this.prevTime,
      this.prevUserEvent
    );
  }

  pop(
    side: BranchName,
    state: EditorInChief,
    selection: boolean
  ): EditorInChiefTransaction | null {
    let branch = side == BranchName.Done ? this.done : this.undone;
    if (branch.length == 0) return null;
    let event = branch[branch.length - 1];
    if (selection && event.selectionsAfter.length) {
      return state.update({
        // selection: event.selectionsAfter[event.selectionsAfter.length - 1],
        annotations: fromHistory.of({ side, rest: popSelection(branch) }),
        userEvent: side == BranchName.Done ? "select.undo" : "select.redo",
        scrollIntoView: true,
      });
    } else if (!event.changes) {
      return null;
    } else {
      let rest = branch.length == 1 ? none : branch.slice(0, branch.length - 1);
      if (event.mapped) rest = addMappingToBranch(rest, event.mapped!);
      // DRAL: Instead of "just" applying the changes, we need to apply the changes all
      // ....  wrapped in EditorDispatchEffect's
      return state.update({
        effects: compact([
          ...event.effects.map(({ cell_id, value: effect }) => {
            if (cell_id == null) return effect;
            return EditorDispatchEffect.of({
              transaction: { effects: effect },
              editor_id: cell_id,
            });
          }),
          ...event.changes.cellMap.entries().map(([cell_id, change]) => {
            return EditorDispatchEffect.of({
              // @ts-ignore
              transaction: { changes: change },
              editor_id: cell_id,
            });
          }),
          // TODO Same here, selection should never have a null cell_id
          event.startSelection?.main.cell_id == null
            ? null
            : EditorDispatchEffect.of({
                transaction: {
                  selection: event.startSelection?.main.value,
                  scrollIntoView: true,
                },
                editor_id: event.startSelection?.main.cell_id,
              }),
        ]),
        annotations: fromHistory.of({ side, rest }),
        filter: false,
        userEvent: side == BranchName.Done ? "undo" : "redo",
        scrollIntoView: true,
      });
    }
  }

  static empty: HistoryState = new HistoryState(none, none);
}

/// Default key bindings for the undo history.
///
/// - Mod-z: [`undo`](#commands.undo).
/// - Mod-y (Mod-Shift-z on macOS) + Ctrl-Shift-z on Linux: [`redo`](#commands.redo).
/// - Mod-u: [`undoSelection`](#commands.undoSelection).
/// - Alt-u (Mod-Shift-u on macOS): [`redoSelection`](#commands.redoSelection).
export const historyKeymap: readonly EditorInChiefKeyBinding<any>[] = [
  { key: "Mod-z", run: undo, preventDefault: true },
  { key: "Mod-y", mac: "Mod-Shift-z", run: redo, preventDefault: true },
  { linux: "Ctrl-Shift-z", run: redo, preventDefault: true },
  { key: "Mod-u", run: undoSelection, preventDefault: true },
  {
    key: "Alt-u",
    mac: "Mod-Shift-u",
    run: redoSelection,
    preventDefault: true,
  },
];

/////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////

let inverted_add_remove_editor = invertedEffects.of((transaction) => {
  /** @type {Array<StateEffect<any>>} */
  let inverted_effects = [];
  for (let effect of transaction.effects) {
    if (effect.is(EditorAddEffect)) {
      let editor_id = effect.value.state.facet(EditorIdFacet);
      inverted_effects.push(
        EditorRemoveEffect.of({
          editor_id: editor_id,
        })
      );
    } else if (effect.is(EditorRemoveEffect)) {
      let { editor_id } = effect.value;
      let cell_state = transaction.startState.editor(editor_id);
      // TODO Focus _should_ be handled by history itself...
      // .... but fat chance is isn't yet
      // let has_selection = cell_state.field(EditorHasSelectionField);
      inverted_effects.push(
        EditorAddEffect.of({
          state: cell_state,
          // focus: has_selection,
        })
      );
    }
  }
  return inverted_effects;
});
