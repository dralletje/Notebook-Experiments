import {
  ChangeDesc,
  ChangeSet,
  EditorSelection,
  StateEffect,
  StateEffectType,
  Text,
} from "@codemirror/state";
import { compact } from "lodash";

class ForCell<T> {
  constructor(public readonly cell_id: string, public readonly value: T) {}

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

export class NotebookText extends ForNotebook<Text> {}

// class CellChangeDesc implements ChangeDesc {
export class CellChangeDesc extends ForNotebook<ChangeDesc> {
  get invertedDesc() {
    return new CellChangeDesc(
      this.items.map((x) => x.mapCell((x) => x.invertedDesc))
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
      this.items.map((item) => {
        return item.mapCell((x, cell_id) => {
          let cell_mapping = mapping.forCell(cell_id);
          if (cell_mapping == null) return x;
          return x.mapDesc(cell_mapping, something);
        });
      })
    );
  }

  composeDesc(other: CellChangeDesc) {
    return new CellChangeDesc(
      this.items.map((item) => {
        return item.mapCell((x, cell_id) => {
          let other_item = other.forCell(cell_id);
          if (other_item == null) return x;
          return x.composeDesc(other_item);
        });
      })
    );
  }

  static fromJSON(json: ReturnType<CellChangeDesc["toJSON"]>) {
    return new CellChangeDesc(
      json.map((x) => ForCell.fromJSON(x, ChangeDesc.fromJSON))
    );
  }
}

export class CellChangeSet extends CellChangeDesc {
  constructor(private readonly changes: Array<ForCell<ChangeSet>>) {
    super(changes);
    if (changes.includes(null)) throw Error("null in changes");
  }

  map(mapping: CellChangeDesc) {
    return new CellChangeSet(
      this.changes.map((for_cell) =>
        for_cell.mapCell((x) => {
          let cell_mapping = mapping.forCell(for_cell.cell_id);
          return cell_mapping == null ? x : x.map(cell_mapping);
        })
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
      this.changes.map((for_cell) =>
        for_cell.mapCell((x) => {
          let other_item = other.forCell(for_cell.cell_id);
          // @ts-ignore
          return other_item == null ? x : x.compose(other_item);
        })
      )
    );
  }

  get empty() {
    console.log(`this.changes:`, this.changes);
    return this.changes.every((x) => x.mapCell((x) => x.empty).value);
  }

  get desc() {
    return new CellChangeDesc(
      this.changes.map((x) => x.mapCell((x) => x.desc))
    );
  }

  static fromJSON(json: ReturnType<CellChangeSet["toJSON"]>) {
    return new CellChangeSet(
      json.map((x) => ForCell.fromJSON(x, ChangeSet.fromJSON))
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
    mapping: CellChangeDesc
  ): readonly CellStateEffect<any>[] {
    let new_effects = effects.map((effect) =>
      effect.mapCellNullable((x, cell_id) => {
        let cell_mapping = mapping.forCell(cell_id);
        if (cell_mapping == null) return x;
        return x.map(cell_mapping);
      })
    );

    return new_effects.map((x) => new CellStateEffect(x.cell_id, x.value));
  }
}

export class EditorViewSelection extends ForCell<EditorSelection> {
  eq(other: EditorViewSelection): boolean {
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
    return new EditorViewSelection(value.cell_id, value.value);
  }

  static fromJSON(json: ReturnType<EditorViewSelection["toJSON"]>): any {
    return new EditorViewSelection(
      json.cell_id,
      EditorSelection.fromJSON(json.value)
    );
  }
}
