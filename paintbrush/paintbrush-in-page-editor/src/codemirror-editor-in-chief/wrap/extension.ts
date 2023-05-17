import { Extension } from "@codemirror/state";

export let editor_in_chief_extensions_to_codemirror = (
  extensions: Array<Extension | EditorInChiefExtension> | EditorInChiefExtension
): Extension => {
  if (Array.isArray(extensions)) {
    return extensions.map((extension) =>
      editor_in_chief_extensions_to_codemirror(extension)
    );
  }
  if (extensions == null) return null;

  return editor_state_extension in extensions
    ? extensions[editor_state_extension]
    : extensions;
};

export const editor_state_extension = Symbol(
  "Extension I can pass to codemirror"
);
export type EditorInChiefExtension =
  | Extension
  | EditorInChiefExtension[]
  | { [editor_state_extension]: Extension };
