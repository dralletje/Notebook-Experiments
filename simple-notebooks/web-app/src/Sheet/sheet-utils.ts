import {
  EditorAddEffect,
  EditorDispatchEffect,
  EditorHasSelectionField,
  EditorId,
  EditorIdFacet,
  EditorInChief,
  EditorInChiefKeymap,
  EditorInChiefTransactionSpec,
} from "codemirror-editor-in-chief";
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
} from "codemirror-editor-in-chief/history";
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
import { SheetPosition } from "../packages/codemirror-sheet/sheet-position";
import { mapValues } from "lodash";
import { ExcellState } from "../ExcellView";

type SheetCell = {
  id: EditorId;
  code: string;
};
export type SheetSerialized = {
  cells: {
    [id: EditorId]: SheetCell;
  };
  size: { columns: number; rows: number };
};

export let editorinchief_to_sheet = (state: ExcellState): SheetSerialized => {
  let cell_editor_states = state.editors;
  return {
    size: {
      columns: state.field(SheetSizeField).columns,
      rows: state.field(SheetSizeField).rows,
    },
    cells: Object.fromEntries(
      cell_editor_states.mapValues((cell_state) => {
        let meta = cell_state.field(CellMetaField);
        return {
          id: cell_state.facet(EditorIdFacet),
          code: meta.code,
        };
      })
    ),
  };
};

export let sheetcell_to_editorstate = (
  editorinchief: ExcellState,
  cell: SheetCell
) => {
  return editorinchief.create_section_editor({
    editor_id: cell.id as EditorId,
    doc: cell.code,
    extensions: [
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
  sheet: SheetSerialized,
  extensions = []
) => {
  // Take cell-id from the URL hash!
  let initial_selected_cell = null;

  let size = {
    columns: sheet?.size?.columns ?? 26,
    rows: sheet?.size?.rows ?? 30,
    // columns: 1,
    // rows: 1,
  };

  if (window.location.hash !== "") {
    initial_selected_cell = SheetPosition.fromId(
      window.location.hash.slice(1) as EditorId,
      size
    );
  }

  return EditorInChief.create({
    editors: (editorstate) => {
      return mapValues(sheet?.cells, (cell, id) =>
        sheetcell_to_editorstate(editorstate, cell)
      );
    },
    extensions: [
      extensions,
      SelectedCellField.init(() => initial_selected_cell),
      SheetSizeField.init(() => size),
      sheet_instant_edits,
      sheet_movement,

      // TODO History stuff
      // .... - I think I just want sheet-wide changes when doing ctrl-z there:
      // ....   any changes inside a cell should be counted as atomic from "cell enter" till "cell leave"
      // .... - Should also turn cell run times back
      // ....   (and engine should understand that changing it back also means it needs to re-run)
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
    ],
  });
};

export let cell_upsert = (
  state: ExcellState,
  cell_id: EditorId,
  fn: (cell: EditorState) => TransactionSpec
) => {
  let cell_state_existing = state.editor(cell_id, false);

  let cell_state =
    cell_state_existing == null
      ? sheetcell_to_editorstate(state, {
          id: cell_id,
          code: "",
          // @ts-ignore
          unsaved_code: "",
        })
      : cell_state_existing;

  return [
    cell_state_existing == null
      ? {
          effects: [
            EditorAddEffect.of({
              state: cell_state,
            }),
          ],
        }
      : {},
    {
      effects: [
        EditorDispatchEffect.of({
          editor_id: cell_id,
          transaction: fn(cell_state),
        }),
      ],
    },
  ];
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
      state: EditorInChief<any>;
      dispatch: (...tr: EditorInChiefTransactionSpec[]) => void;
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
      let has_hyper_focus =
        state.editors.get(position.id)?.field(EditorHasSelectionField) ?? false;
      if (has_hyper_focus) return;

      dispatch(
        ...cell_upsert(state, position.id, (cell_state) => ({
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
          ...cell_upsert(view.state, position.id, (cell_state) => ({
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
          ...cell_upsert(state, cell_id, (cell_state) => ({
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
          ...cell_upsert(state, cell_id, (cell_state) => ({
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
