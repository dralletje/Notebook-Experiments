import { Extension, StateField } from "@codemirror/state";
import { EditorInChief } from "../editor-in-chief-state";
import {
  EditorInChiefExtension,
  editor_in_chief_extensions_to_codemirror,
  editor_state_extension,
} from "./extension";
import { EditorInChiefTransaction } from "./transaction";

type EditorInChiefStateFieldSpec<T, JSON = any> = {
  create: (state: EditorInChief<any>) => T;
  update: (value: T, tr: EditorInChiefTransaction) => T;
  provide?: (field: StateField<T>) => Extension | EditorInChiefExtension;
  toJSON?: (value: T) => JSON;
  fromJSON?: (input: JSON) => T;
};
export class EditorInChiefStateFieldInit {
  constructor(public init: Extension) {
    this.init = init;
  }
  get [editor_state_extension](): Extension {
    return this.init;
  }
}
export class EditorInChiefStateField<T> {
  constructor(private __field: StateField<T>) {
    this.__field = __field;
  }

  get [editor_state_extension](): Extension {
    return this.__field;
  }

  /** @deprecated */
  get field() {
    return this.__field;
  }

  init(init: (state: EditorInChief) => T) {
    return new EditorInChiefStateFieldInit(
      this.__field.init((state) => {
        return init(new EditorInChief(state));
      })
    );
  }

  static define<T>(spec: EditorInChiefStateFieldSpec<T>) {
    return new EditorInChiefStateField(
      StateField.define({
        create: (state) => spec.create(new EditorInChief(state)),
        update: (value, tr) => {
          return spec.update(
            value,
            new EditorInChiefTransaction(new EditorInChief(tr.startState), tr)
          );
        },
        provide: (field) =>
          editor_in_chief_extensions_to_codemirror(spec.provide?.(field)),
      })
    );
  }
}
