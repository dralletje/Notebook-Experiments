import { EditorState } from "@codemirror/state";
import { EditorInChief } from "../src/editor-in-chief";
import { AsEditorId } from "../src/logic";
import { BareEditorState, EditorMapping } from "../src/editor-in-chief-state";

let editor_in_chief = EditorInChief.create({
  editors: () => ({
    a: EditorState.create({}),
    b: EditorState.create({}),
    c: EditorInChief.create({ editors: () => ({}) }),
  }),
});

let x = editor_in_chief.editor(AsEditorId("a"));
let x2 = editor_in_chief.editor(AsEditorId("c"));

let z = editor_in_chief.update({});
let state: typeof editor_in_chief = z.state;

type EditorStateMapping = { [k: string]: EditorState };

let editorstate_in_chief = null as any as EditorInChief<EditorStateMapping>;
let editorbare_in_chief = null as any as EditorInChief<EditorMapping>;

editorbare_in_chief == editorstate_in_chief;

let should_be_possible: EditorInChief = editorstate_in_chief;

editorstate_in_chief as EditorInChief;

let g = editorstate_in_chief.selected_editor();
let h = editorbare_in_chief.selected_editor();

g == h;

let bare: BareEditorState = null as any as EditorState;

let mapping: EditorMapping = null as any as EditorStateMapping;

let in_chief: EditorInChief<EditorMapping> = null as any as EditorInChief<{
  [k: string]: BareEditorState;
}>;
