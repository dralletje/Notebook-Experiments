import { CellId } from "../codemirror-notebook/cell";
import { ALPHABET } from "./alphabet";
import { SheetSize } from "./sheet-layout";

export type SheetPositionSpec = { column: number; row: number };
export class SheetPosition {
  column: number;
  row: number;
  size: SheetSize;
  constructor(
    { column, row }: { column: number; row: number },
    size: SheetSize
  ) {
    this.column = column;
    this.row = row;
    this.size = size;
  }

  eq(other: SheetPosition) {
    return (
      this.column === other.column &&
      this.row === other.row &&
      this.size === other.size
    );
  }

  get id() {
    return `${ALPHABET[this.column - 1]}${this.row}` as CellId;
  }
  get up() {
    if (this.row === 1) {
      return null;
    }
    return new SheetPosition(
      {
        column: this.column,
        row: this.row - 1,
      },
      this.size
    );
  }
  get down() {
    if (this.row === this.size.rows) {
      return null;
    }
    return new SheetPosition(
      {
        column: this.column,
        row: this.row + 1,
      },
      this.size
    );
  }
  get left() {
    if (this.column === 1) {
      return null;
    }
    return new SheetPosition(
      {
        column: this.column - 1,
        row: this.row,
      },
      this.size
    );
  }
  get right() {
    if (this.column === this.size.columns) {
      return null;
    }
    return new SheetPosition(
      {
        column: this.column + 1,
        row: this.row,
      },
      this.size
    );
  }
}
