import {
  ChangeDesc,
  ChangeSet,
  EditorSelection,
  SelectionRange,
  StateEffect,
  StateEffectType,
  Text,
} from "@codemirror/state";
import { compact } from "lodash";
import { ModernMap } from "../ModernMap";
import { EditorId } from "./logic";

class ForCell<T> {
  constructor(public readonly cell_id: EditorId, public readonly value: T) {}

  mapCell<R>(
    f: (x: T, cell_id: EditorId | null) => NonNullable<R>
  ): ForCell<R> {
    return new ForCell(this.cell_id, f(this.value, this.cell_id));
  }
  mapCellNullable<R>(
    f: (x: T, cell_id: EditorId | null) => R | undefined | null
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

export class EditorInChiefText extends ModernMap<EditorId, Text> {}

export class EditorInChiefChangeDesc {
  private _changedescs: ModernMap<EditorId, ChangeDesc>;
  constructor(entries: Iterable<readonly [EditorId, ChangeDesc]>) {
    this._changedescs = new ModernMap(entries);
  }
  get cellMap() {
    return this._changedescs;
  }
  get(cell_id: EditorId): ChangeDesc | undefined {
    return this._changedescs.get(cell_id);
  }

  get invertedDesc() {
    return new EditorInChiefChangeDesc(
      this._changedescs.mapValues((x) => x.invertedDesc)
    );
  }

  iterChangedRanges(
    f: (
      cell_id: EditorId | null,
      fromA: number,
      toA: number,
      fromB: number,
      toB: number
    ) => void
  ) {
    this._changedescs.forEach((change, cell_id) =>
      change.iterChangedRanges((fromA, toA, fromB, toB) => {
        return f(cell_id, fromA, toA, fromB, toB);
      })
    );
  }

  mapDesc(mapping: EditorInChiefChangeDesc, something?: boolean) {
    return new EditorInChiefChangeDesc(
      this._changedescs.mapValues((item, cell_id) => {
        let cell_mapping = mapping.get(cell_id);
        if (cell_mapping == null) return item;
        return item.mapDesc(cell_mapping, something);
      })
    );
  }

  composeDesc(other: EditorInChiefChangeDesc) {
    return new EditorInChiefChangeDesc(
      this._changedescs.mapValues((item, cell_id) => {
        let other_item = other.get(cell_id);
        if (other_item == null) return item;
        return item.composeDesc(other_item);
      })
    );
  }

  toJSON() {
    return [...this._changedescs.mapValues((x) => x.toJSON()).entries()];
  }
  static fromJSON(json: ReturnType<EditorInChiefChangeDesc["toJSON"]>) {
    return new EditorInChiefChangeDesc(
      json.map(([id, x]) => [id, ChangeDesc.fromJSON(x)])
    );
  }
}

export class EditorInChiefChangeSet extends EditorInChiefChangeDesc {
  private _changespecs: ModernMap<EditorId, ChangeSet>;
  constructor(entries: Iterable<readonly [EditorId, ChangeSet]>) {
    super(entries);
    this._changespecs = new ModernMap(entries);

    if (this._changespecs.some((x) => x == null)) {
      throw new Error("AAAAA");
    }
  }
  get cellMap() {
    return this._changespecs;
  }

  map(mapping: EditorInChiefChangeDesc) {
    return new EditorInChiefChangeSet(
      this._changespecs.mapValues((x, cell_id) => {
        let cell_mapping = mapping.get(cell_id);
        return cell_mapping == null ? x : x.map(cell_mapping);
      })
    );
  }

  invert(docs: ModernMap<EditorId, Text>): EditorInChiefChangeSet {
    return new EditorInChiefChangeSet(
      this._changespecs
        .mapValues((x, cell_id) => {
          let cell_doc = docs.get(cell_id);
          return cell_doc == null ? x : x.invert(cell_doc);
        })
        .filter((x) => x != null)
    );
  }

  compose(other: EditorInChiefChangeSet) {
    return new EditorInChiefChangeSet(
      this._changespecs.mapValues((x, cell_id) => {
        let other_item = other.get(cell_id);
        // @ts-ignore
        return other_item == null ? x : x.compose(other_item);
      })
    );
  }

  get empty() {
    return this._changespecs.every((x) => x.empty);
  }

  get desc() {
    return new EditorInChiefChangeDesc(
      this._changespecs.mapValues((x) => x.desc)
    );
  }

  toJSON() {
    return [...this._changespecs.mapValues((x) => x.toJSON()).entries()];
  }
  static fromJSON(json: ReturnType<EditorInChiefChangeSet["toJSON"]>) {
    return new EditorInChiefChangeSet(
      json.map(([id, x]) => [id, ChangeSet.fromJSON(x)])
    );
  }
}

// @ts-ignore
export class CellStateEffect<T>
  extends ForCell<StateEffect<T>>
  implements StateEffect<T>
{
  is<T>(type: StateEffectType<T>): this is StateEffect<T> {
    return this.value.is(type);
  }

  static mapEffects(
    effects: readonly CellStateEffect<any>[],
    mapping: EditorInChiefChangeDesc
  ): readonly CellStateEffect<any>[] {
    let new_effects = effects.map((effect) =>
      effect.mapCellNullable((x, cell_id) => {
        let cell_mapping = mapping.get(cell_id);
        if (cell_mapping == null) return x;
        return x.map(cell_mapping);
      })
    );

    return new_effects.map((x) => new CellStateEffect(x.cell_id, x.value));
  }
}

export class EditorInChiefRange extends ForCell<SelectionRange> {
  eq(other: EditorInChiefRange): boolean {
    return this.cell_id == other.cell_id && this.value.eq(other.value);
  }

  empty() {
    return this.value.empty;
  }
}

export class EditorInChiefSelection {
  ranges: EditorInChiefRange[];
  mainIndex = 0;
  constructor(ranges: EditorInChiefRange[], mainIndex: number = 0) {
    this.ranges = ranges;
    this.mainIndex = mainIndex;
  }

  get main() {
    return this.ranges[this.mainIndex];
  }

  eq(other: EditorInChiefSelection): boolean {
    if (
      this.ranges.length != other.ranges.length ||
      this.mainIndex != other.mainIndex
    )
      return false;
    for (let i = 0; i < this.ranges.length; i++)
      if (!this.ranges[i].eq(other.ranges[i])) return false;
    return true;
  }

  map(mapping: EditorInChiefChangeDesc) {
    return new EditorInChiefSelection(
      this.ranges.map((range) => {
        let cell_mapping = mapping.get(range.cell_id);
        if (cell_mapping == null) return range;
        return new EditorInChiefRange(
          range.cell_id,
          range.value.map(cell_mapping)
        );
      }),
      this.mainIndex
    );
  }
}
