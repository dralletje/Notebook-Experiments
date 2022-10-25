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
  StateField,
  StateCommand,
  StateEffect,
  Facet,
  Annotation,
  Extension,
  ChangeSet,
  ChangeDesc,
  EditorSelection,
  StateEffectType,
  Text,
} from "@codemirror/state";
import { KeyBinding, EditorView } from "@codemirror/view";

import { isolateHistory, invertedEffects } from "@codemirror/commands";
export { isolateHistory, invertedEffects };

import {
  CellDispatchEffect,
  NestedEditorStatesField,
  CellIdFacet,
} from "./MultiEditor";
import { compact } from "lodash-es";

class ForCell<T> {
  constructor(
    public readonly cell_id: string | null,
    public readonly value: T
  ) {}

  mapCell<R>(f: (x: T, cell_id: string | null) => NonNullable<R>): ForCell<R> {
    return new ForCell(this.cell_id, f(this.value, this.cell_id));
  }
  mapCellNullable<R>(
    f: (x: T, cell_id: string | null) => R | undefined | null
  ): ForCell<R> | null {
    let value = f(this.value, this.cell_id);
    return value == null ? null : new ForCell(this.cell_id, value);
  }

  toJSON() {
    return {
      cell_id: this.cell_id,
      // @ts-expect-error
      value: this.value.toJSON(),
    };
  }

  static fromJSON<T>(json: any, fromJSON: (json: any) => T): ForCell<T> {
    return new ForCell(json.cell_id, fromJSON(json.value));
  }
}

class ForNotebook<T> {
  constructor(public readonly items: ForCell<T>[]) {}

  forCell(cell_id: string | null): T | undefined {
    const x = this.items.find((x) => x.cell_id == cell_id);
    return x?.value;
  }

  toJSON() {
    return this.items.map((x) => x.toJSON());
  }
}

// class CellEditorSelection implements EditorSelection
class CellEditorSelection extends ForCell<EditorSelection> {
  eq(other: CellEditorSelection): boolean {
    return this.cell_id == other.cell_id && this.value.eq(other.value);
  }

  map(mapping: CellChangeDesc) {
    let value = this.mapCell((x, cell_id) => {
      let cell_mapping = mapping.forCell(cell_id);
      if (cell_mapping == null) {
        return x;
      } else {
        return x.map(cell_mapping);
      }
    });
    return new CellEditorSelection(value.cell_id, value.value);
  }

  static fromJSON(json: ReturnType<CellEditorSelection["toJSON"]>): any {
    return new CellEditorSelection(
      json.cell_id,
      EditorSelection.fromJSON(json.value)
    );
  }
}
// @ts-ignore
class CellStateEffect<T>
  extends ForCell<StateEffect<T>>
  implements StateEffect<T>
{
  is<T>(type: StateEffectType<T>): this is StateEffect<T> {
    return this.value.is(type);
  }

  static mapEffects(
    effects: readonly CellStateEffect<any>[],
    mapping: CellChangeDesc
  ): readonly CellStateEffect<any>[] {
    let new_effects = compact(
      effects.map((effect) =>
        effect.mapCellNullable((x, cell_id) => {
          let cell_mapping = mapping.forCell(cell_id);
          if (cell_mapping == null) return x;
          return x.map(cell_mapping);
        })
      )
    );

    return new_effects.map((x) => new CellStateEffect(x.cell_id, x.value));
  }
}

class NotebookTransaction {
  constructor(private readonly _transaction: Transaction) {}

  get state(): EditorState {
    return this._transaction.state;
  }

  get startState(): EditorState {
    return this._transaction.startState;
  }

  private get states(): ForCell<EditorState>[] {
    let cells = Object.entries(
      this.state.field(NestedEditorStatesField).cells
    ).map(([cell_id, state]) => new ForCell(cell_id, state));

    return [...cells, new ForCell(null, this.state)];
  }

  private get startStates(): ForCell<EditorState>[] {
    let cells = Object.entries(
      this.startState.field(NestedEditorStatesField).cells
    ).map(([cell_id, state]) => new ForCell(cell_id, state));

    return [...cells, new ForCell(null, this.state)];
  }

  private get cell_transactions() {
    return this.state.field(NestedEditorStatesField)
      .transactions_to_send_to_cells;
  }

  get docs() {
    return compact(this.states.map((x) => x.mapCell((x) => x.doc)));
  }

  get startDocs() {
    return compact(this.startStates.map((x) => x.mapCell((x) => x.doc)));
  }

  get startSelection() {
    let cell_states = this.startState.field(NestedEditorStatesField);
    let cell_with_current_selection = cell_states.cell_with_current_selection;

    if (cell_with_current_selection != null) {
      if (cell_states.cells[cell_with_current_selection] == null) {
        console.log(`⚠ cell ${cell_with_current_selection} not found`);
        return new CellEditorSelection(null, this.startState.selection);
      }

      return new CellEditorSelection(
        cell_with_current_selection,
        cell_states.cells[cell_with_current_selection].selection
      );
    } else {
      // Mehh
      return new CellEditorSelection(null, this.startState.selection);
    }
  }

  get changes(): CellChangeSet {
    let transactions_to_send_to_cells = this.cell_transactions;

    let cell_changes: { [cell_id: string]: ChangeSet } = {};

    for (let transaction of transactions_to_send_to_cells) {
      let cell_id = transaction.state.facet(CellIdFacet);
      if (cell_changes[cell_id] == null) {
        cell_changes[cell_id] = transaction.changes;
      } else {
        cell_changes[cell_id] = cell_changes[cell_id].compose(
          transaction.changes
        );
      }
    }

    return new CellChangeSet(
      Object.entries(cell_changes).map(
        ([cell_id, changes]) => new ForCell(cell_id, changes)
      )
    );
  }
}

// class CellChangeDesc implements ChangeDesc {
class CellChangeDesc extends ForNotebook<ChangeDesc> {
  get invertedDesc() {
    return new CellChangeDesc(
      compact(this.items.map((x) => x.mapCell((x) => x.invertedDesc)))
    );
  }

  iterChangedRanges(
    f: (
      cell_id: string | null,
      fromA: number,
      toA: number,
      fromB: number,
      toB: number
    ) => void
  ) {
    this.items.forEach((x) =>
      x.value.iterChangedRanges((fromA, toA, fromB, toB) => {
        return f(x.cell_id, fromA, toA, fromB, toB);
      })
    );
  }

  mapDesc(mapping: CellChangeDesc, something?: boolean) {
    return new CellChangeDesc(
      compact(
        this.items.map((item) => {
          return item.mapCell((x, cell_id) => {
            let cell_mapping = mapping.forCell(cell_id);
            if (cell_mapping == null) return x;
            return x.mapDesc(cell_mapping, something);
          });
        })
      )
    );
  }

  composeDesc(other: CellChangeDesc) {
    return new CellChangeDesc(
      compact(
        this.items.map((item) => {
          return item.mapCell((x, cell_id) => {
            let other_item = other.forCell(cell_id);
            if (other_item == null) return x;
            return x.composeDesc(other_item);
          });
        })
      )
    );
  }

  static fromJSON(json: ReturnType<CellChangeDesc["toJSON"]>) {
    return new CellChangeDesc(
      json.map((x) => ForCell.fromJSON(x, ChangeDesc.fromJSON))
    );
  }
}

class NotebookText extends ForNotebook<Text> {}

class CellChangeSet extends CellChangeDesc {
  constructor(private readonly changes: Array<ForCell<ChangeSet>>) {
    super(changes);
  }

  map(mapping: CellChangeDesc) {
    return new CellChangeSet(
      compact(
        this.changes.map((for_cell) =>
          for_cell.mapCell((x) => {
            let cell_mapping = mapping.forCell(for_cell.cell_id);
            return cell_mapping == null ? x : x.map(cell_mapping);
          })
        )
      )
    );
  }

  invert(docs: NotebookText): CellChangeSet {
    return new CellChangeSet(
      compact(
        this.changes.map((for_cell) =>
          for_cell.mapCellNullable((x) => {
            let doc = docs.forCell(for_cell.cell_id);
            return doc == null ? null : x.invert(doc);
          })
        )
      )
    );
  }

  compose(other: CellChangeSet) {
    return new CellChangeSet(
      compact(
        this.changes.map((for_cell) =>
          for_cell.mapCell((x) => {
            let other_item = other.forCell(for_cell.cell_id);
            // @ts-ignore
            return other_item == null ? x : x.compose(other_item);
          })
        )
      )
    );
  }

  get empty() {
    return this.changes.every((x) => x.mapCell((x) => x.empty).value);
  }

  get desc() {
    return new CellChangeDesc(
      compact(this.changes.map((x) => x.mapCell((x) => x.desc)))
    );
  }

  static fromJSON(json: ReturnType<CellChangeSet["toJSON"]>) {
    return new CellChangeSet(
      json.map((x) => ForCell.fromJSON(x, ChangeSet.fromJSON))
    );
  }
}

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

const historyField_ = StateField.define({
  create() {
    return HistoryState.empty;
  },

  update(state: HistoryState, tr: Transaction): HistoryState {
    let config = tr.state.facet(historyConfig);

    let notebook_tr = new NotebookTransaction(tr);

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
      else other = addSelection(other, notebook_tr.startSelection);
      return new HistoryState(
        from == BranchName.Done ? fromHist.rest : other,
        from == BranchName.Done ? other : fromHist.rest
      );
    }

    let isolate = tr.annotation(isolateHistory);
    if (isolate == "full" || isolate == "before") state = state.isolate();

    if (tr.annotation(Transaction.addToHistory) === false)
      return !tr.changes.empty
        ? state.addMapping(notebook_tr.changes.desc)
        : state;

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
    else if (tr.selection)
      state = state.addSelection(
        notebook_tr.startSelection,
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
export function shared_history(config: HistoryConfig = {}): Extension {
  return [
    historyField_,
    historyConfig.of(config),
    EditorView.domEventHandlers({
      beforeinput(e, view) {
        let command =
          e.inputType == "historyUndo"
            ? undo
            : e.inputType == "historyRedo"
            ? redo
            : null;
        if (!command) return false;
        e.preventDefault();
        return command(view);
      },
    }),
  ];
}

/// The state field used to store the history data. Should probably
/// only be used when you want to
/// [serialize](#state.EditorState.toJSON) or
/// [deserialize](#state.EditorState^fromJSON) state objects in a way
/// that preserves history.
export const historyField = historyField_ as StateField<unknown>;

function cmd(side: BranchName, selection: boolean): StateCommand {
  return function ({
    state,
    dispatch,
  }: {
    state: EditorState;
    dispatch: (tr: Transaction) => void;
  }) {
    if (!selection && state.readOnly) return false;
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

function depth(side: BranchName) {
  return function (state: EditorState): number {
    let histState = state.field(historyField_, false);
    if (!histState) return 0;
    let branch = side == BranchName.Done ? histState.done : histState.undone;
    return branch.length - (branch.length && !branch[0].changes ? 1 : 0);
  };
}

/// The amount of undoable change events available in a given state.
export const undoDepth = depth(BranchName.Done);
/// The amount of redoable change events available in a given state.
export const redoDepth = depth(BranchName.Undone);

// History events store groups of changes or effects that need to be
// undone/redone together.
class CellHistEvent {
  constructor(
    // The changes in this event. Normal events hold at least one
    // change or effect. But it may be necessary to store selection
    // events before the first change, in which case a special type of
    // instance is created which doesn't hold any changes, with
    // changes == startSelection == undefined
    readonly changes: CellChangeSet | undefined,
    // The effects associated with this event
    readonly effects: readonly CellStateEffect<any>[],
    // Accumulated mapping (from addToHistory==false) that should be
    // applied to events below this one.
    readonly mapped: CellChangeDesc | undefined,
    // The selection before this event
    readonly startSelection: CellEditorSelection | undefined,
    // Stores selection changes after this event, to be used for
    // selection undo/redo.
    readonly selectionsAfter: readonly CellEditorSelection[]
  ) {}

  setSelAfter(after: readonly CellEditorSelection[]) {
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
      startSelection: this.startSelection?.toJSON(),
      selectionsAfter: this.selectionsAfter.map((s) => s.toJSON()),
    };
  }

  static fromJSON(json: any) {
    return new CellHistEvent(
      json.changes && CellChangeSet.fromJSON(json.changes),
      [],
      json.mapped && CellChangeDesc.fromJSON(json.mapped),
      json.startSelection && CellEditorSelection.fromJSON(json.startSelection),
      json.selectionsAfter.map(CellEditorSelection.fromJSON)
    );
  }

  // This does not check `addToHistory` and such, it assumes the
  // transaction needs to be converted to an item. Returns null when
  // there are no changes or effects in the transaction.
  // DRAL CHANGES:
  // - Goes through the inverted changes for the main transaction,
  //   but also asks every cell for it's possible inverted changes.
  static fromTransaction(
    raw_transaction: Transaction,
    selection?: CellEditorSelection
  ) {
    let notebook_tr = new NotebookTransaction(raw_transaction);

    let effects: readonly CellStateEffect<any>[] = none;

    let transactions_to_send_to_cells = notebook_tr.state.field(
      NestedEditorStatesField
    ).transactions_to_send_to_cells;

    for (let invert of raw_transaction.startState.facet(invertedEffects)) {
      let result = invert(raw_transaction).map(
        (x) => new CellStateEffect(null, x)
      );
      if (result.length) effects = effects.concat(result);
    }
    for (let transaction of transactions_to_send_to_cells) {
      let cell_id = transaction.state.facet(CellIdFacet);
      for (let invert of transaction.startState.facet(invertedEffects)) {
        let result = invert(transaction).map(
          (x) => new CellStateEffect(cell_id, x)
        );
        if (result.length) effects = effects.concat(result);
      }
    }

    if (!effects.length && notebook_tr.changes.empty) return null;
    return new CellHistEvent(
      notebook_tr.changes.invert(new NotebookText(notebook_tr.startDocs)),
      effects,
      undefined,
      selection || notebook_tr.startSelection,
      none
    );
  }

  static selection(selections: readonly CellEditorSelection[]) {
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

function isAdjacent(a: CellChangeDesc, b: CellChangeDesc): boolean {
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
  { value: a, cell_id: cell_id_a }: CellEditorSelection,
  { value: b, cell_id: cell_id_b }: CellEditorSelection
) {
  return (
    cell_id_a === cell_id_b &&
    a.ranges.length == b.ranges.length &&
    a.ranges.filter((r, i) => r.empty != b.ranges[i].empty).length === 0
  );
}

function conc<T>(a: readonly T[], b: readonly T[]) {
  return !a.length ? b : !b.length ? a : a.concat(b);
}

const none: readonly any[] = [];

const MaxSelectionsPerEvent = 200;

function addSelection(branch: Branch, selection: CellEditorSelection) {
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
function addMappingToBranch(branch: Branch, mapping: CellChangeDesc) {
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
  mapping: CellChangeDesc,
  extraSelections: readonly CellEditorSelection[]
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
    selection: CellEditorSelection,
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

  addMapping(mapping: CellChangeDesc): HistoryState {
    return new HistoryState(
      addMappingToBranch(this.done, mapping),
      addMappingToBranch(this.undone, mapping),
      this.prevTime,
      this.prevUserEvent
    );
  }

  pop(
    side: BranchName,
    state: EditorState,
    selection: boolean
  ): Transaction | null {
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
      // ....  wrapped in CellDispatchEffect's
      return state.update({
        changes: undefined,
        selection: undefined,
        effects: compact([
          ...event.effects.map(({ cell_id, value: effect }) => {
            if (cell_id == null) return effect;
            return CellDispatchEffect.of({
              transaction: { effects: effect },
              cell_id: cell_id,
            });
          }),
          ...event.changes.items.map(({ cell_id, value: change }) => {
            // TODO Changes can only happen on an actual editor, so this should never be null
            if (cell_id == null) return null;
            return CellDispatchEffect.of({
              // @ts-ignore
              transaction: { changes: change },
              cell_id: cell_id,
            });
          }),
          // TODO Same here, selection should never have a null cell_id
          event.startSelection?.cell_id == null
            ? null
            : CellDispatchEffect.of({
                transaction: {
                  selection: event.startSelection.value,
                  scrollIntoView: true,
                },
                cell_id: event.startSelection.cell_id,
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
export const historyKeymap: readonly KeyBinding[] = [
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
