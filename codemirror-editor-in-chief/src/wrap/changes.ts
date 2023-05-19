import { ChangeDesc, ChangeSet, Text } from "@codemirror/state";
import { ModernMap } from "@dral/modern-map";
import { EditorId } from "../logic";

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
