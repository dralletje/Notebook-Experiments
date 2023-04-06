import {
  EditorAddEffect,
  EditorDispatchEffect,
  EditorHasSelectionField,
  EditorId,
  EditorIdFacet,
  EditorInChief,
  EditorInChiefKeymap,
} from "../packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
  MutateCellMetaEffect,
  Notebook,
  NotebookSerialized,
} from "../packages/codemirror-notebook/cell";
import { CellOrderField } from "../packages/codemirror-notebook/cell-order.js";
import {
  historyKeymap,
  shared_history,
} from "../packages/codemirror-editor-in-chief/codemirror-shared-history";
import { HyperfocusField } from "../packages/codemirror-sheet/hyperfocus";
import { cell_keymap } from "../packages/codemirror-sheet/sheet-keymap";
import {
  EditorSelection,
  EditorState,
  Facet,
  TransactionSpec,
} from "@codemirror/state";
import {
  SelectedCellEffect,
  SelectedCellField,
} from "../packages/codemirror-sheet/sheet-selected-cell";
import { SheetSizeField } from "../packages/codemirror-sheet/sheet-layout";
import { sheet_movement } from "../packages/codemirror-sheet/sheet-movement";
import { EditorInChiefTransactionSpec } from "../packages/codemirror-editor-in-chief/wrap/transaction";
import { SheetPosition } from "../packages/codemirror-sheet/sheet-position";

export let editorinchief_to_sheet = (
  state: EditorInChief<EditorState>
): Notebook => {
  let cell_editor_states = state.editors;
  return {
    cell_order: state.field(CellOrderField),
    cells: Object.fromEntries(
      cell_editor_states.mapValues((cell_state) => {
        let type = cell_state.facet(CellTypeFacet);
        return {
          id: cell_state.facet(EditorIdFacet),
          unsaved_code: cell_state.doc.toString(),
          ...cell_state.field(CellMetaField),
          type: type,

          // This autosaves the text cells
          // TODO? Do we want this?
          ...(type === "text" ? { code: cell_state.doc.toString() } : {}),
        };
      })
    ),
  };
};

export let sheetcell_to_editorstate = (
  editorinchief: EditorInChief<EditorState>,
  cell: any
) => {
  return editorinchief.create_section_editor({
    editor_id: cell.id as EditorId,
    doc: cell.unsaved_code ?? cell.code,
    extensions: [
      // @ts-ignore
      EditorIdFacet.of(cell.id),
      CellMetaField.init(() => ({
        code: cell.code,
        requested_run_time: 0,
        folded: false,
        type: "code",
      })),
      HyperfocusField,
      cell_keymap,
    ],
  });
};

export let sheet_to_editorinchief = (
  notebook: NotebookSerialized,
  extensions = []
) => {
  return EditorInChief.create({
    editors: (editorstate) => {
      return {};
    },
    extensions: [
      extensions,
      SelectedCellField,
      SheetSizeField.init(() => ({
        columns: 26,
        rows: 100,
        // columns: 1,
        // rows: 1,
      })),
      sheet_instant_edits,
      sheet_movement,

      // This works so smooth omg
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
    ],
  });
};

export let cell_upsert = (
  state: EditorInChief<EditorState>,
  cell_id: EditorId,
  fn: (cell: EditorState) => TransactionSpec
) => {
  let cell_state_existing = state.editor(cell_id, false);

  let cell_state =
    cell_state_existing == null
      ? sheetcell_to_editorstate(state, {
          id: cell_id,
          code: "",
          unsaved_code: "",
        })
      : cell_state_existing;

  return {
    effects: [
      ...(cell_state_existing == null
        ? [
            EditorAddEffect.of({
              editor_id: cell_id,
              state: cell_state,
            }),
          ]
        : []),
      EditorDispatchEffect.of({
        editor_id: cell_id,
        transaction: fn(cell_state),
      }),
    ],
  };
};

export interface DOMEventMap extends HTMLElementEventMap {
  [other: string]: any;
}

/// Event handlers are specified with objects like this. For event
/// types known by TypeScript, this will infer the event argument type
/// to hold the appropriate event object type. For unknown events, it
/// is inferred to `any`, and should be explicitly set if you want type
/// checking.
export type DOMEventHandlers<This> = {
  [event in keyof DOMEventMap]?: (
    this: This,
    event: DOMEventMap[event],
    view: {
      state: EditorInChief<EditorState>;
      dispatch: (tr: EditorInChiefTransactionSpec) => void;
    },
    cell_id: SheetPosition
  ) => boolean | void;
};

export let cellEventHandlersField = Facet.define<DOMEventHandlers<any>>({});

export let sheet_instant_edits = [
  cellEventHandlersField.of({
    click: (event, { state, dispatch }, position) => {
      let has_hyper_focus =
        state.editors.get(position.id)?.field(EditorHasSelectionField) ?? false;

      if (has_hyper_focus) return;
      // TODO For some reason this is even gets here because has_hyper_focus
      // .... gets sneakily set to false by the editor?

      dispatch({
        effects: [SelectedCellEffect.of(position)],
      });
      return true;
    },
    focus: (event, { state, dispatch }, position) => {
      dispatch({
        effects: [SelectedCellEffect.of(position)],
      });
    },
    dblclick: (event, { state, dispatch }, position) => {
      // if (has_hyper_focus) return;

      dispatch(
        cell_upsert(state, position.id, (cell_state) => ({
          selection: EditorSelection.create([
            EditorSelection.cursor(cell_state.doc.length),
          ]),
        }))
      );
      return true;
    },
    keydown: (event, view, position) => {
      if (event.target !== event.currentTarget) return false;
      // If unhandeld, we check for a single character keypress
      // that is most likely something that needs to be inputted
      if (event.metaKey || event.ctrlKey) return false;
      if (event.key.length === 1) {
        view.dispatch(
          cell_upsert(view.state, position.id, (cell_state) => ({
            selection: EditorSelection.create([EditorSelection.cursor(1)]),
            changes: {
              from: 0,
              to: cell_state.doc.length,
              insert: event.key,
            },
          }))
        );
        return true;
      }
    },
  }),
  EditorInChiefKeymap.of([
    {
      key: "Enter",
      run: ({ state, dispatch }) => {
        let cell_id = state.field(SelectedCellField)?.id;
        if (!cell_id) return false;

        dispatch(
          cell_upsert(state, cell_id, (cell_state) => ({
            selection: EditorSelection.create([
              EditorSelection.cursor(cell_state.doc.length),
            ]),
          }))
        );
        return true;
      },
    },
    {
      key: "Backspace",
      run: ({ state, dispatch }) => {
        let cell_id = state.field(SelectedCellField)?.id;
        if (!cell_id) return false;

        dispatch(
          cell_upsert(state, cell_id, (cell_state) => ({
            changes: {
              from: 0,
              to: cell_state.doc.length,
              insert: "",
            },
            effects: [
              MutateCellMetaEffect.of((cell) => {
                cell.code = "";
                cell.requested_run_time = Date.now();
              }),
            ],
          }))
        );
        return true;
      },
    },
  ]),
];
