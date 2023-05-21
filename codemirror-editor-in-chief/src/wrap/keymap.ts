import { Extension } from "@codemirror/state";
import { keymap, KeyBinding } from "@codemirror/view";
import { BareEditorState, EditorInChief } from "../editor-in-chief-state";
import { editor_state_extension } from "./extension";
import { EditorInChiefTransactionSpec } from "./transaction";

export type EditorInChiefCommand<Editor extends EditorInChief> = (view: {
  state: Editor;
  dispatch: (...specs: EditorInChiefTransactionSpec[]) => void;
}) => boolean;

export type EditorInChiefKeyBinding<E extends EditorInChief> = {
  key?: string;
  linux?: string;
  mac?: string;
  win?: string;
  preventDefault?: boolean;
  run: EditorInChiefCommand<EditorInChief>;
  scope?: KeyBinding["scope"];
  shift?: EditorInChiefCommand<EditorInChief>;
};

export class EditorInChiefKeymap {
  constructor(public extension: Extension) {
    this.extension = extension;
  }
  get [editor_state_extension](): Extension {
    return this.extension;
  }

  static of<E extends EditorInChief>(
    shortcuts: readonly EditorInChiefKeyBinding<E>[]
  ) {
    // @ts-expect-error I am piggybacking on the codemirror keymap stuff
    // ................ because I am too lazy to rewrite the whole keymap stuff
    return new EditorInChiefKeymap(keymap.of(shortcuts));
  }
}
