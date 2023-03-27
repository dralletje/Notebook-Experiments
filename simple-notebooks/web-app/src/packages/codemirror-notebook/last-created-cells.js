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

    let previous_cell_ids = Object.keys(tr.startState.editors);
    let cell_ids = Object.keys(tr.state.editors);
    if (previous_cell_ids === cell_ids) return value;

    let new_cell_ids = cell_ids.filter((id) => !previous_cell_ids.includes(id));
    return new_cell_ids;
  },
});
