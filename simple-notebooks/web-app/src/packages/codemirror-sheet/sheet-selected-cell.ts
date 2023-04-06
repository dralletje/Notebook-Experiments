import { StateEffect } from "@codemirror/state";
import { SheetSizeField } from "./sheet-layout";
import { EditorInChiefStateField } from "../codemirror-editor-in-chief/editor-in-chief";
import { SheetPosition, SheetPositionSpec } from "./sheet-position";

export const SelectedCellEffect =
  StateEffect.define<SheetPositionSpec | null>();
export const SelectedCellField =
  EditorInChiefStateField.define<SheetPosition | null>({
    create(state) {
      return null;
    },
    update(value, tr) {
      for (let effect of tr.effects) {
        if (effect.is(SelectedCellEffect)) {
          let sheet_size = tr.state.field(SheetSizeField);
          if (effect.value == null) continue;
          value = new SheetPosition(effect.value, sheet_size);
        }
      }
      return value;
    },
  });
