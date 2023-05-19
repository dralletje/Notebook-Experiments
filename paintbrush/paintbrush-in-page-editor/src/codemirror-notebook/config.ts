import { EditorState, Facet } from "@codemirror/state";
import { EditorInChief } from "../codemirror-editor-in-chief/editor-in-chief";
import { EditorMapping } from "../codemirror-editor-in-chief/editor-in-chief-state";

type EditorStateFactory = (
  parent_state: EditorInChief<{ [k: string]: EditorState }>,
  code: string
) => EditorState;
export let create_empty_cell_facet = Facet.define<
  EditorStateFactory,
  EditorStateFactory
>({
  combine: (values) => values[0],
});
