import { Annotation, AnnotationType } from "@codemirror/state";
import { EditorInChiefStateField } from "../codemirror-editor-in-chief/editor-in-chief";

/** @type {AnnotationType<true>} */
export let NoAnimation = Annotation.define();

export let LastCreatedCells = EditorInChiefStateField.define({
  create() {
    return /** @type {import("./cell").CellId[]} */ ([]);
  },
  update(value, tr) {
    if (tr.annotation(NoAnimation)) return value;

    let previous_cell_ids = new Set(tr.startState.editors.keys());
    let cell_ids = new Set(tr.state.editors.keys());

    if (previous_cell_ids === cell_ids) return value;

    let new_cell_ids = [];
    for (let id of cell_ids) {
      if (!previous_cell_ids.has(id)) {
        new_cell_ids.push(id);
      }
    }

    return new_cell_ids;
  },
});
