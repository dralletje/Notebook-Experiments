import {
  SelectionRange,
  StateEffect,
  StateEffectType,
  Text,
} from "@codemirror/state";
import { ModernMap } from "@dral/modern-map";
import { EditorId } from "./logic";
import { EditorInChiefChangeDesc } from "./wrap/changes";

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

// @ts-ignore
export class CellStateEffect<T> extends ForCell<StateEffect<T>> {
  is<T>(type: StateEffectType<T>): this is StateEffect<T> {
    return this.value.is(type);
  }

  map(mapping: EditorInChiefChangeDesc): CellStateEffect<T> {
    let cell_mapping = mapping.get(this.cell_id);
    if (cell_mapping == null) return this;
    return new CellStateEffect(this.cell_id, this.value.map(cell_mapping));
  }

  static mapEffects(
    effects: readonly CellStateEffect<any>[],
    mapping: EditorInChiefChangeDesc
  ): readonly CellStateEffect<any>[] {
    return effects.map((effect) => effect.map(mapping));
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
