import {
  EditorState,
  Extension,
  Facet,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import { EditorView, keymap, KeyBinding } from "@codemirror/view";

import {
  EditorsField,
  inverted_add_remove_editor,
  expand_cell_effects_that_are_actually_meant_for_the_nexus,
  create_nested_editor_state,
  BlurEditorInChiefEffect,
  EditorDispatchEffect,
  EditorAddEffect,
  EditorRemoveEffect,
  EditorExtension,
  EditorIdFacet,
  EditorInChiefEffect,
} from "./logic";

import {
  EditorHasSelectionField,
  EditorHasSelectionEffect,
} from "./editor-has-selection-extension";
import { extract_nested_viewupdate } from "./extract-nested-viewupdate";

export {
  extract_nested_viewupdate,
  EditorsField,
  EditorIdFacet,
  EditorExtension,
  EditorRemoveEffect,
  EditorAddEffect,
  EditorHasSelectionField,
  EditorHasSelectionEffect,
  create_nested_editor_state,
  EditorDispatchEffect,
  EditorInChiefEffect,
  BlurEditorInChiefEffect,
};

type EditorId = string;

let editor_in_chief_extensions_to_codemirror = (
  extensions: Array<Extension | EditorInChiefExtension> | EditorInChiefExtension
): Extension => {
  return Array.isArray(extensions)
    ? extensions.map((extension) =>
        editor_state_extension in extension
          ? extension[editor_state_extension]
          : extension
      )
    : extensions == null
    ? null
    : editor_in_chief_extensions_to_codemirror([extensions]);
};

const editor_state_extension = Symbol("Editor I can pass to codemirror");
type EditorInChiefExtension =
  | Extension
  | { [editor_state_extension]: Extension };

type EditorInChiefTransactionSpec = {
  effects: StateEffect<any> | StateEffect<any>[];
};
export class EditorInChiefTransaction {
  state: EditorInChief;

  constructor(
    public startState: EditorInChief,
    public transaction: Transaction
  ) {
    this.transaction = transaction;
    this.state = new EditorInChief(this.transaction.state);
  }

  annotation(x) {
    return this.transaction.annotation(x);
  }

  get effects() {
    return this.transaction.effects;
  }
}

type EditorInChiefStateFieldSpec<T> = {
  create: (state: EditorInChief) => T;
  update: (value: T, tr: EditorInChiefTransaction) => T;
  provide?: (field: StateField<T>) => Extension | EditorInChiefExtension;
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

// export class EditorInChiefStateFacet<I,O> {
//   constructor(private __facet: Facet<I,O>) {
//     this.__facet = __facet;
//   }
//   /** @deprecated */
//   get facet() {
//     return this.__facet;
//   }
//   of(value: I): EditorInChiefExtension {
//     return this.__facet.of(value)
//   }
//   static define<I,O>(config: Parameters<typeof Facet["define"]>[0]) {
//     return new EditorInChiefStateFacet(
//       Facet.define({
//         create: (state) => spec.create(new EditorInChief(state)),
//         update: (value, tr) => {
//           return spec.update(
//             value,
//             new EditorInChiefTransaction(new EditorInChief(tr.startState), tr)
//           );
//         },
//         provide: (field) =>
//           editor_in_chief_extensions_to_codemirror(spec.provide?.(field)),
//       })
//     );
//   }
// }

type EditorInChiefCommand = (view: {
  state: EditorInChief;
  dispatch: (...specs: EditorInChiefTransactionSpec[]) => void;
}) => boolean;
type EditorInChiefKeyBinding = {
  key: string;
  linux?: string;
  mac?: string;
  win?: string;
  preventDefault?: boolean;
  run: EditorInChiefCommand;
  scope?: KeyBinding["scope"];
  shift?: EditorInChiefCommand;
};

export class EditorInChiefView {
  constructor(private view: EditorView) {
    this.view = view;
  }

  get state() {
    return new EditorInChief(this.view.state);
  }

  dispatch = (...specs: EditorInChiefTransactionSpec[]) => {
    this.view.dispatch(
      ...specs.map((spec) => {
        return { effects: spec.effects };
      })
    );
  };
}

export class EditorInChiefKeymap {
  constructor(public extension: Extension) {
    this.extension = extension;
  }
  get [editor_state_extension](): Extension {
    return this.extension;
  }

  static of(shortcuts: EditorInChiefKeyBinding[]) {
    return new EditorInChiefKeymap(
      keymap.of(
        shortcuts.map((shortcut) => {
          return {
            ...shortcut,
            run: (view) => shortcut.run(new EditorInChiefView(view)),
            shift: (view) => shortcut.run(new EditorInChiefView(view)),
          };
        })
      )
    );
  }
}

let EditorInChiefCache = new WeakMap<EditorState, EditorInChief>();

export class EditorInChief {
  constructor(public editorstate: EditorState) {
    this.editorstate = editorstate;

    if (EditorInChiefCache.has(editorstate)) {
      return EditorInChiefCache.get(editorstate);
    } else {
      EditorInChiefCache.set(editorstate, this);
    }
  }

  // TODO Make this cooler
  toJSON(...args) {
    return this.editorstate.toJSON(...args);
  }

  facet<T>(facet: Facet<any, T>) {
    return this.editorstate.facet(facet);
  }
  // facet<T>(facet: Facet<any, T> | EditorInChiefFacet<any, T>) {
  //   if (facet instanceof EditorInChiefFacet) {
  //     return this.editorstate.facet(facet.facet);
  //   } else {
  //     return this.editorstate.facet(facet);
  //   }
  // }

  field<T>(field: StateField<T> | EditorInChiefStateField<T>): T;
  field<T>(
    field: StateField<T> | EditorInChiefStateField<T>,
    required: false
  ): T | undefined;
  field(field: StateField<any> | EditorInChiefStateField<any>, required?) {
    if (field instanceof EditorInChiefStateField) {
      return this.editorstate.field(field.field, required) as any;
    } else {
      return this.editorstate.field(field, required) as any;
    }
  }

  update(...specs: EditorInChiefTransactionSpec[]) {
    // Instead of `expand_cell_effects_that_are_actually_meant_for_the_nexus` transactionExtender,
    // I would like to "extend" the transaction here. This makes it possible to keep the order of effects right.
    return new EditorInChiefTransaction(
      this,
      this.editorstate.update(...specs)
    );
  }

  get editors() {
    return this.editorstate.field(EditorsField).cells;
  }
  editor(editor_id: EditorId): EditorState;
  editor(editor_id: EditorId, required?: false): EditorState | undefined {
    if (required !== false && !this.editors[editor_id]) {
      throw new Error(`Editor with id ${editor_id} not found`);
    }
    return this.editors[editor_id];
  }

  static editors(editorstate: EditorState) {
    return editorstate.field(EditorsField).cells;
  }

  static create({
    editors,
    extensions = [],
  }: {
    editors: (editorstate: EditorInChief) => { [key: EditorId]: EditorState };
    extensions?: EditorInChiefExtension[];
  }) {
    let extensions_with_state_fields =
      editor_in_chief_extensions_to_codemirror(extensions);

    return new EditorInChief(
      EditorState.create({
        extensions: [
          EditorsField,
          expand_cell_effects_that_are_actually_meant_for_the_nexus,
          inverted_add_remove_editor,
          EditorsField.init((editorstate) => ({
            cells: editors(new EditorInChief(editorstate)),
            transactions_to_send_to_cells: [],
            cell_with_current_selection: null,
          })),
          extensions_with_state_fields,
        ],
      })
    );
  }
}
