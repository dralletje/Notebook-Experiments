import { EditorState } from "@codemirror/state";
import { EditorInChief } from "../src/editor-in-chief";
import { as_editor_id } from "../src/logic";
import { BareEditorState, EditorMapping } from "../src/editor-in-chief-state";
import { ModernMap } from "@dral/modern-map";

let editor_in_chief = EditorInChief.create({
  editors: () => ({
    a: EditorState.create({}),
    b: EditorState.create({}),
    c: EditorInChief.create({ editors: () => ({}) }),
  }),
});

let x = editor_in_chief.editor(as_editor_id("a"));
let empty_editor = editor_in_chief.editor(as_editor_id("c"));

// @ts-expect-error - Can't get an editor because there is no valid key :D
empty_editor.editor("hi");

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

editorbare_in_chief.editors;
editorstate_in_chief.editors;
editor_in_chief.editors;

editorbare_in_chief.editors == editorstate_in_chief.editors;
editorbare_in_chief.editors.emplace == editorstate_in_chief.editors.emplace;

let map2: ModernMap<{}, {}> = null as any as ModernMap<{ x: 10 }, { x: 10 }>;
