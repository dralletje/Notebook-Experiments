import React from "react";
import { CellList } from "./Notebook";
import { EditorState } from "@codemirror/state";
import {
  CellEditorStatesField,
  CellIdFacet,
  CellMetaField,
  editor_state_for_cell,
  nested_cell_states_basics,
  useViewUpdate,
} from "./NotebookEditor";
import { useRealMemo } from "use-real-memo";
import {
  SelectCellsEffect,
  SelectedCellsField,
  selected_cells_keymap,
} from "./cell-selection";
import { keymap, runScopeHandlers } from "@codemirror/view";
import {
  shared_history,
  historyKeymap,
} from "./packages/codemirror-nexus/codemirror-shared-history";
import { isEqual, mapValues } from "lodash";
import {
  CellIdOrder,
  cell_movement_extension_default,
} from "./packages/codemirror-nexus/codemirror-cell-movement";
import { notebook_keymap } from "./packages/codemirror-nexus/add-move-and-run-cells";
import { SelectionArea } from "./selection-area/SelectionArea";

let try_json = (str) => {
  try {
    return JSON.parse(str);
  } catch (error) {
    return null;
  }
};

let cell_id_order_from_notebook_facet = CellIdOrder.compute(
  [CellEditorStatesField],
  (state) => state.field(CellEditorStatesField).cell_order
);

export let MetaNotebook = () => {
  let initial_notebook = React.useMemo(
    () =>
      CellEditorStatesField.init((editorstate) => {
        /** @type {import("./notebook-types").Notebook} */
        let notebook_from_json = try_json(
          localStorage.getItem("meta-notebook")
        ) ?? {
          id: "1",
          cell_order: ["1", "2", "3"],
          cells: {
            1: {
              id: "1",
              code: "1 + 1 + xs.length",
              unsaved_code: "1 + 1 + xs.length",
              last_run: Date.now(),
            },
            2: {
              id: "2",
              code: "let xs = [1,2,3,4]",
              unsaved_code: "let xs = [1,2,3,4]",
              last_run: Date.now(),
            },
            3: {
              id: "3",
              code: "xs.map((x) => x * 2)",
              unsaved_code: "xs.map((x) => x * 2)",
              last_run: Date.now(),
            },
          },
        };

        return {
          cell_order: notebook_from_json.cell_order,
          cells: mapValues(notebook_from_json.cells, (cell) => {
            return editor_state_for_cell(cell, editorstate);
          }),
          transactions_to_send_to_cells: [],
          cell_with_current_selection: null,
        };
      }),
    [CellEditorStatesField]
  );

  let [notebook_state, set_notebook_state] = React.useState(
    EditorState.create({
      extensions: [
        // expand_cell_effects_that_area_actually_meant_for_the_nexus,

        initial_notebook,
        nested_cell_states_basics,

        notebook_keymap,

        SelectedCellsField,
        cell_id_order_from_notebook_facet,

        cell_movement_extension_default,
        selected_cells_keymap,

        // // blur_cells_when_selecting,
        // keep_track_of_last_created_cells_extension,

        // This works so smooth omg
        useRealMemo(() => [shared_history(), keymap.of(historyKeymap)], []),

        // just_for_kicks_extension
      ],
    })
  );

  let viewupdate = useViewUpdate(notebook_state, set_notebook_state);

  let cell_editor_states = viewupdate.state.field(CellEditorStatesField);

  let notebook = React.useMemo(() => {
    return /** @type {import("./notebook-types").Notebook} */ ({
      cell_order: cell_editor_states.cell_order,
      cells: mapValues(cell_editor_states.cells, (cell_state) => {
        return {
          id: cell_state.facet(CellIdFacet),
          unsaved_code: cell_state.doc.toString(),
          ...cell_state.field(CellMetaField),
        };
      }),
    });
  }, [cell_editor_states]);

  let selected_cells = viewupdate.state.field(SelectedCellsField);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", flex: 1 }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) {
          return;
        }
        let should_cancel = runScopeHandlers(
          // @ts-ignore
          { state, dispatch },
          event.nativeEvent,
          "editor"
        );
        if (should_cancel) {
          event.preventDefault();
        }
      }}
    >
      <SelectionArea
        on_selection={(new_selected_cells) => {
          if (!isEqual(new_selected_cells, selected_cells)) {
            viewupdate.view.dispatch({
              effects: SelectCellsEffect.of(new_selected_cells),
            });
          }
        }}
      >
        <div style={{ padding: 16 }}>
          <h1>Meta</h1>
          <p>
            I want this page to become a notebook that can access the main
            process, and influence the notebook web page. This way you can write
            your own plugins.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginRight: 16,
          }}
        >
          <CellList
            viewupdate={viewupdate}
            notebook={notebook}
            engine={{ cylinders: {} }}
          />
        </div>
      </SelectionArea>
    </div>
  );
};
