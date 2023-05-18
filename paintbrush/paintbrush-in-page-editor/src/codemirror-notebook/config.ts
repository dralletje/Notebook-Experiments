import { EditorState, Facet } from "@codemirror/state";
import { EditorInChief } from "../codemirror-editor-in-chief/editor-in-chief";

type EditorStateFactory = (
  parent_state: EditorInChief<EditorState>,
  code: string
) => EditorState;
export let create_empty_cell_facet = Facet.define<
  EditorStateFactory,
  EditorStateFactory
>({
  combine: (values) => values[0],
});
