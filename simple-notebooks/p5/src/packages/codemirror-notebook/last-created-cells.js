import { Annotation, AnnotationType } from "@codemirror/state";
import { EditorInChiefStateField } from "codemirror-editor-in-chief";
import { CellOrderField } from "./cell-order.js";

/** @type {AnnotationType<true>} */
export let NoAnimation = Annotation.define();

export let LastCreatedCells = EditorInChiefStateField.define({
  create() {
    return /** @type {import("./cell").CellId[]} */ ([]);
  },
  update(value, tr) {
    if (tr.annotation(NoAnimation)) return value;

    let previous_cell_ids = tr.startState.field(CellOrderField);
    let cell_ids = tr.state.field(CellOrderField);

    if (previous_cell_ids === cell_ids) return value;

    let new_cell_ids = [];
    for (let id of cell_ids) {
      // TODO? use a Set instead of an array for performance?
      if (!previous_cell_ids.includes(id)) {
        new_cell_ids.push(id);
      }
    }

    return new_cell_ids;
  },
});
