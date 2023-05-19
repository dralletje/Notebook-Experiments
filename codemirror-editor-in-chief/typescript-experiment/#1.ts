import { EditorState } from "@codemirror/state";
import { EditorInChief } from "../src/editor-in-chief";
import { AsEditorId } from "../src/logic";

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
