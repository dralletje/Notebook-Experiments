import {
  EditorSelection,
  EditorState,
  Facet,
  StateField,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ModernMap } from "@dral/modern-map";

import {
  EditorsField,
  expand_cell_effects_that_are_actually_meant_for_the_nexus,
  EditorId,
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
    return new ModernMap(
      Object.entries(this.editorstate.field(EditorsField).cells)
    ) as ModernMap<EditorId, EditorState>;
  }

  editor(editor_id: EditorId): EditorState;
  editor(editor_id: EditorId, required?: false): EditorState | undefined {
    if (required !== false && !this.editors.has(editor_id)) {
      throw new Error(`Editor with id ${editor_id} not found`);
    }
    return this.editors.get(editor_id);
  }

  get selection() {
    let cell_with_current_selection =
      this.editorstate.field(EditorsField).cell_with_current_selection;

    if (cell_with_current_selection != null) {
      return new EditorInChiefSelection([
        new EditorInChiefRange(
          cell_with_current_selection,
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
    return this.editors.mapValues((x) => x.doc);
  }

  static editors(editorstate: EditorState) {
    return new EditorInChief(editorstate).editors;
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
