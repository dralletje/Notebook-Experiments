import {
  EditorSelection,
  EditorState,
  EditorStateConfig,
  Facet,
  StateField,
} from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { ModernMap } from "@dral/modern-map";

import {
  EditorsField,
  expand_cell_effects_that_are_actually_meant_for_the_nexus,
  EditorId,
  EditorIdFacet,
  EditorExtension,
} from "./logic";
import {
  EditorInChiefRange,
  EditorInChiefSelection,
  EditorInChiefText,
} from "./wrap-cell-types";
import {
  EditorInChiefExtension,
  editor_in_chief_extensions_to_codemirror,
} from "./wrap/extension";
import { EditorInChiefStateField } from "./wrap/statefield";
import {
  EditorInChiefTransaction,
  EditorInChiefTransactionSpec,
} from "./wrap/transaction";
import { editor_has_selection_extension } from "./editor-has-selection-extension";

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
        return {
          effects: spec.effects,
          annotations: spec.annotations,

          scrollIntoView: spec.scrollIntoView,
          filter: spec.filter,
          userEvent: spec.userEvent,
        };
      })
    );
  };
}

interface Transaction<S> {
  state: S;
  startState: S;
}
interface TransactionSpec<S> {}
export interface BareEditorState {
  update(...specs: TransactionSpec<this>[]): Transaction<this>;
  facet<T>(facet: Facet<any, T>): T;
  field<T>(field: StateField<T>): T;
}

export type EditorMapping = { [key: string]: BareEditorState };
export type EditorKeyOf<T extends EditorMapping> = Extract<keyof T, string>;

let EditorInChiefCache = new WeakMap<BareEditorState, EditorInChief<any>>();

export class EditorInChief<Editors extends EditorMapping = EditorMapping> {
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

  section_editor_extensions(editor_id: EditorId) {
    return [
      EditorIdFacet.of(editor_id),
      editor_has_selection_extension,
      this.facet(EditorExtension) ?? [],
    ];
  }
  create_section_editor({
    editor_id,
    doc,
    extensions,
    selection,
  }: {
    editor_id: EditorId;
    doc?: EditorStateConfig["doc"];
    extensions?: EditorStateConfig["extensions"];
    selection?: EditorStateConfig["selection"];
  }) {
    return EditorState.create({
      doc: doc,
      selection: selection,
      extensions: [this.section_editor_extensions(editor_id), extensions ?? []],
    });
  }

  update(
    ...specs: EditorInChiefTransactionSpec[]
  ): EditorInChiefTransaction<this> {
    // Instead of `expand_cell_effects_that_are_actually_meant_for_the_nexus` transactionExtender,
    // I would like to "extend" the transaction here. This makes it possible to keep the order of effects right.
    return new EditorInChiefTransaction(
      this,
      this.editorstate.update(...specs)
    ) as any;
  }

  get editors(): any {
    return new ModernMap(
      Object.entries(this.editorstate.field(EditorsField).cells)
    ) as any as ModernMap<
      EditorId<EditorKeyOf<Editors>>,
      Editors[EditorKeyOf<Editors>]
    >;
  }

  editor<K extends EditorKeyOf<Editors>>(editor_id: EditorId<K>): Editors[K];
  editor<K extends EditorKeyOf<Editors>>(
    editor_id: EditorId<K>,
    required: false
  ): Editors[K] | undefined;
  editor<K extends EditorKeyOf<Editors>>(
    editor_id: EditorId<K>,
    required?: false
  ): Editors[Extract<K, string>] | undefined {
    if (required !== false && !this.editors.has(editor_id)) {
      throw new Error(`Editor with id ${editor_id} not found`);
    }
    return this.editors.get(editor_id) as any;
  }

  // editor<K extends EditorKeyOf<Editors>>(editor_id: EditorId<K>): Editors[K] {
  //   return this.editors.get(editor_id) as any;
  // }

  get selection() {
    let cell_with_current_selection =
      this.editorstate.field(EditorsField).cell_with_current_selection;

    if (cell_with_current_selection != null) {
      return new EditorInChiefSelection([
        new EditorInChiefRange(
          cell_with_current_selection,
          // @ts-ignore Need to make editor EVEN MORE GENERIC
          this.editor(cell_with_current_selection).selection.main
        ),
      ]);
    } else {
      // TODO
      return new EditorInChiefSelection([
        new EditorInChiefRange(null, EditorSelection.cursor(0)),
      ]);
    }
  }
  get doc(): EditorInChiefText {
    // @ts-ignore Need to make editor EVEN MORE GENERIC
    return this.editors.mapValues((x) => x.doc);
  }

  selected_editor(): Editors[EditorKeyOf<Editors>] | null {
    let cell_with_current_selection = this.editorstate.field(EditorsField)
      .cell_with_current_selection as EditorId<EditorKeyOf<Editors>>;
    if (cell_with_current_selection != null) {
      return this.editor(cell_with_current_selection, false);
    } else {
      return null;
    }
  }

  /**
   * @deprecated Why is this here?!
   */
  static editors(editorstate: EditorState) {
    return new EditorInChief(editorstate).editors;
  }
  static create<Editors extends EditorMapping>({
    editors,
    extensions = [],
  }: {
    editors: (editorstate: EditorInChief<any>) => Editors;
    extensions?: EditorInChiefExtension[];
  }): EditorInChief<Editors> {
    let extensions_with_state_fields =
      editor_in_chief_extensions_to_codemirror(extensions);

    return new EditorInChief(
      EditorState.create({
        extensions: [
          EditorsField,
          expand_cell_effects_that_are_actually_meant_for_the_nexus,
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
