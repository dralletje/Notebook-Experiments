import { Prec, EditorSelection } from "@codemirror/state";
import { keymap } from "@codemirror/view";

// import { MoveToCellBelowEffect } from "./cell-movement";
import { format_with_prettier } from "../../codemirror-javascript/format-javascript-with-prettier";
import { SelectedCellsField } from "./cell-selection";
import { range } from "lodash";
import {
  EditorAddEffect,
  EditorDispatchEffect,
  EditorIdFacet,
  EditorRemoveEffect,
  EditorInChiefEffect,
  EditorInChiefKeymap,
} from "codemirror-editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
  MutateCellMetaEffect,
  NudgeCell,
  empty_cell,
} from "./cell";
import { CellOrderField, CellOrderEffect } from "./cell-order.js";
import { NoAnimation } from "./last-created-cells.js";
import { syntaxTree } from "@codemirror/language";
import { create_cell_state } from "../../Notebook/notebook-utils";

export let notebook_keymap = EditorInChiefKeymap.of([
  {
    key: "Mod-/",
    run: ({ state, dispatch }) => {
      let selected_cells = state.field(SelectedCellsField);

      let cells = selected_cells.map((cell_id) => state.editor(cell_id));

      let selected_code_cells = cells.filter(
        (cell) => cell.facet(CellTypeFacet) === "code"
      );

      if (selected_code_cells.length === 0) return false;

      let COMMENT_REGEX = /^([\t ]*)(\/\/ ?)/;

      // Go though all lines in every cell and check if they all start with `//`
      let all_lines_start_with_comment = selected_code_cells.every((cell) => {
        let lines = Array.from(cell.doc.iterLines());
        return lines.every((line) => COMMENT_REGEX.test(line));
      });

      if (all_lines_start_with_comment) {
        // Remove `//` from all lines in all selected cells
        dispatch({
          effects: selected_code_cells.map((cell) =>
            EditorDispatchEffect.of({
              editor_id: cell.facet(EditorIdFacet),
              transaction: {
                changes: range(1, cell.doc.lines + 1).map((line_number) => {
                  let line = cell.doc.line(line_number);
                  let [_, spaces, part_to_remove] =
                    /** @type {RegExpExecArray} */ (
                      COMMENT_REGEX.exec(line.text)
                    );
                  return {
                    from: line.from + spaces.length,
                    to: line.from + spaces.length + part_to_remove.length,
                    insert: "",
                  };
                }),
              },
            })
          ),
        });
      } else {
        dispatch({
          effects: selected_code_cells.map((cell) =>
            EditorDispatchEffect.of({
              editor_id: cell.facet(EditorIdFacet),
              transaction: {
                changes: range(1, cell.doc.lines + 1).map((line_number) => {
                  let line = cell.doc.line(line_number);
                  return {
                    from: line.from,
                    to: line.from,
                    insert: "// ",
                  };
                }),
              },
            })
          ),
        });
      }

      return true;
    },
  },
  {
    key: "Mod-s",
    run: ({ state, dispatch }) => {
      let cell_order = state.field(CellOrderField);
      let now = Date.now(); // Just in case map takes a lot of time ??

      let changed_cells = cell_order.filter((cell_id) => {
        let cell = state.editor(cell_id);
        if (cell.facet(CellTypeFacet) === "text") return false;

        return cell.doc.toString() !== cell.field(CellMetaField).code;
      });

      let prettified_results = changed_cells.map((cell_id) => {
        let cell_state = state.editor(cell_id);
        try {
          let { cursorOffset, formatted } = format_with_prettier({
            code: cell_state.doc.toString(),
            cursor: cell_state.selection.main.head,
          });
          return {
            docLength: cell_state.doc.length,
            cursorOffset: cursorOffset,
            formatted: formatted,
            cell_id,
          };
        } catch (error) {
          // TODO Nudge cell if it can't parse?
          return {
            docLength: cell_state.doc.length,
            cursorOffset: cell_state.selection.main.head,
            formatted: cell_state.doc.toString(),
            cell_id,
          };
        }
      });

      dispatch({
        effects: prettified_results.flatMap(
          ({ cursorOffset, docLength, formatted, cell_id }) => [
            EditorDispatchEffect.of({
              editor_id: cell_id,
              transaction: {
                selection: EditorSelection.cursor(cursorOffset),
                changes: {
                  from: 0,
                  to: docLength,
                  insert: formatted,
                },
                effects: [
                  MutateCellMetaEffect.of((cell) => {
                    cell.code = formatted;
                    cell.requested_run_time = now;
                  }),
                ],
              },
            }),
          ]
        ),
      });
      return true;
    },
  },
]);

export let cell_keymap = Prec.high(
  keymap.of([
    {
      key: "Shift-Enter",
      run: ({ state, dispatch }) => {
        // TODO Should just not apply this to text cells to begin with 🤷‍♀️ but cba
        if (state.facet(CellTypeFacet) === "text") return false;

        let cursor = state.selection.main.head;
        let code = state.doc.toString();
        let changed_code = false;
        try {
          let { cursorOffset, formatted } = format_with_prettier({
            code: state.doc.toString(),
            cursor: state.selection.main.head,
          });
          cursor = cursorOffset;
          code = formatted;
          changed_code = true;
        } catch (error) {
          dispatch({
            annotations: [NudgeCell.of(true)],
          });
        }

        dispatch({
          changes: changed_code
            ? {
                from: 0,
                to: state.doc.length,
                insert: code,
              }
            : undefined,
          selection: EditorSelection.cursor(cursor),
          effects: [
            MutateCellMetaEffect.of((cell) => {
              cell.code = code;
              cell.requested_run_time = Date.now();
            }),
          ],
        });
        return true;
      },
    },
    {
      // If we press enter while the previous two lines are empty, we want to add a new cell/split this cell
      key: "Enter",
      run: ({ state, dispatch }) => {
        if (!state.selection.main.empty) return false;
        let cursor = state.selection.main.from;

        // TODO Check if we are "outside" anything in the syntax tree
        // .... (Or allow blocks maybe? But not incomplete, nor inside strings or objects etc)

        let cell_id = state.facet(EditorIdFacet);
        let cell_type = state.facet(CellTypeFacet);

        // TODO Should just not apply this to text cells to begin with 🤷‍♀️ but cba
        // if (state.facet(CellTypeFacet) === "text") return false;

        let current_line = state.doc.lineAt(cursor);
        if (current_line.number === 1)
          // Can't split the from line
          return false;
        if (
          current_line.text.slice(0, cursor - current_line.from).trim() !== ""
        )
          // Can't split if there is text before the cursor
          return false;

        let previous_line = state.doc.line(current_line.number - 1);

        if (previous_line.text.trim() !== "") return false;

        let new_cell = {
          ...empty_cell(cell_type),
          unsaved_code: state.doc.sliceString(cursor, state.doc.length),
        };

        dispatch({
          changes: {
            from: Math.max(previous_line.from - 1, 0),
            to: state.doc.length,
            insert: "",
          },
          annotations: NoAnimation.of(true),
          effects: [
            EditorInChiefEffect.of((state) => {
              return [
                EditorAddEffect.of({
                  editor_id: new_cell.id,
                  state: create_cell_state(state, new_cell),
                }),
                CellOrderEffect.of({
                  cell_id: new_cell.id,
                  index: { after: cell_id },
                }),
                EditorDispatchEffect.of({
                  editor_id: new_cell.id,
                  transaction: { selection: EditorSelection.cursor(0) },
                }),
              ];
            }),
          ],
        });
        return true;
      },
    },
    {
      key: "Mod-Enter",
      run: (view) => {
        let cell_id = view.state.facet(EditorIdFacet);

        let cell_meta = view.state.field(CellMetaField);
        let code = view.state.doc.toString();

        if (view.state.facet(CellTypeFacet) === "text") return false;

        let new_cell = empty_cell();
        view.dispatch({
          effects: [
            ...(cell_meta.code !== code
              ? [
                  MutateCellMetaEffect.of((cell) => {
                    cell.code = code;
                    cell.requested_run_time = Date.now();
                  }),
                ]
              : []),
            EditorInChiefEffect.of((editor_in_chief) => [
              EditorAddEffect.of({
                editor_id: new_cell.id,
                state: create_cell_state(editor_in_chief, new_cell),
              }),
              CellOrderEffect.of({
                cell_id: new_cell.id,
                index: { after: cell_id },
              }),
              EditorDispatchEffect.of({
                editor_id: new_cell.id,
                transaction: { selection: EditorSelection.cursor(0) },
              }),
            ]),
          ],
        });
        return true;
      },
    },
    {
      key: "Backspace",
      run: (view) => {
        let cell_id = view.state.facet(EditorIdFacet);
        let cell_type = view.state.facet(CellTypeFacet);
        if (!view.state.selection.main.empty) return false;

        if (view.state.selection.main.from === 0) {
          view.dispatch({
            effects: [
              EditorInChiefEffect.of((state) => {
                let cell_order = state.field(CellOrderField);
                let cell_index = cell_order.indexOf(cell_id);
                if (cell_index === 0)
                  return EditorDispatchEffect.of({
                    editor_id: cell_id,
                    transaction: {
                      annotations: NudgeCell.of(true),
                    },
                  });

                let previous_cell_id = cell_order[cell_index - 1];
                let previous_cell_state = state.editor(previous_cell_id);
                let previous_cell_type =
                  previous_cell_state.facet(CellTypeFacet);

                // You can't merge with a cell of a different type
                // But you can remove the current cell if it is empty
                if (previous_cell_type !== cell_type) {
                  if (view.state.doc.length === 0) {
                    return [
                      EditorDispatchEffect.of({
                        editor_id: previous_cell_id,
                        transaction: {
                          selection: EditorSelection.cursor(
                            previous_cell_state.doc.length
                          ),
                        },
                      }),
                      EditorRemoveEffect.of({ editor_id: cell_id }),
                      CellOrderEffect.of({
                        cell_id: cell_id,
                        index: null,
                      }),
                    ];
                  } else {
                    return EditorDispatchEffect.of({
                      editor_id: cell_id,
                      transaction: {
                        annotations: NudgeCell.of(true),
                      },
                    });
                  }
                }

                return [
                  EditorDispatchEffect.of({
                    editor_id: previous_cell_id,
                    transaction: {
                      selection: EditorSelection.cursor(
                        previous_cell_state.doc.length + 2
                      ),
                      changes: {
                        from: previous_cell_state.doc.length,
                        to: previous_cell_state.doc.length,
                        insert: "\n\n" + view.state.doc.toString(),
                      },
                    },
                  }),
                  EditorRemoveEffect.of({ editor_id: cell_id }),
                  CellOrderEffect.of({
                    cell_id: cell_id,
                    index: null,
                  }),
                ];
              }),
            ],
          });
          return true;
        } else {
          return false;
        }
      },
    },
  ])
);
