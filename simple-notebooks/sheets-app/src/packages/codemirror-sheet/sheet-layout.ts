import { EditorInChiefStateField } from "codemirror-editor-in-chief";

export type SheetSize = {
  rows: number;
  columns: number;
};
export const SheetSizeField = EditorInChiefStateField.define<SheetSize>({
  create(state) {
    return {
      rows: 30,
      columns: 12,
    };
  },
  update(value, tr) {
    // Nothing... yet!
    return value;
  },
});
