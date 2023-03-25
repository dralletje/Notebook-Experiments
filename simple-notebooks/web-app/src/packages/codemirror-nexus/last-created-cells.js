import { EditorInChiefStateField } from "../codemirror-editor-in-chief/EditorInChief";

export let LastCreatedCells = EditorInChiefStateField.define({
  create() {
    return /** @type {import("../../notebook-types").CellId[]} */ ([]);
  },
  update(value, tr) {
    let previous_cell_ids = Object.keys(tr.startState.editors);
    let cell_ids = Object.keys(tr.state.editors);
    if (previous_cell_ids === cell_ids) return value;
    let new_cell_ids = cell_ids.filter((id) => !previous_cell_ids.includes(id));
    return new_cell_ids;
  },
});
