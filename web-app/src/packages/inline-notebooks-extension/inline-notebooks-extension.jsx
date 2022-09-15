/**
 * Works better than I was expecting...
 * Now for how to actually make it useful within the editor... 🤷‍♀️
 */

import { EditorState, Range, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { dropWhile, last, takeWhile } from "lodash";
import React from "react";
import { ReactWidget, useEditorView } from "react-codemirror-widget";
import styled from "styled-components";
import { useImmerStore } from "use-immer-store";
import { produce } from "immer";

import { Cell } from "../../App";

let HEADER_COMMENT = `// ╔═╡ `;
let DELIMITER_COMMENT = `// ╠═╡ `;
let FOOTER_COMMENT = `// ╚═╡ `;

let script_to_notebook = (/** @type {string} */ script) => {
  let lines = script.split("\n");

  // Remove any lines before the first comment
  lines = dropWhile(lines, (line) => !line.startsWith(HEADER_COMMENT));

  let notebook = /** @type {import("../../App").Notebook} */ ({
    id: "",
    cell_order: [],
    cells: {},
  });

  let current_lines = lines;
  while (current_lines.length !== 0) {
    let id = current_lines[0].slice(HEADER_COMMENT.length);
    let content = takeWhile(
      current_lines.slice(1),
      (line) => !line.startsWith(HEADER_COMMENT)
    );

    console.log(`content:`, content);
    console.log(`current_lines:`, current_lines);
    current_lines = current_lines.slice(content.length + 1);

    if (content[content.length - 1].trim() === "")
      content = content.slice(0, -1);
    let code = content.join("\n");

    notebook.cells[id] = {
      id,
      code,
      last_run: -Infinity,
      unsaved_code: code,
    };
    notebook.cell_order.push(id);
  }

  return notebook;
};
let notebook_to_script = (
  /** @type {import("../../App").Notebook} */ notebook
) => {
  let header_line = `${HEADER_COMMENT}${notebook.id}\n`;
  let footer_line = `${FOOTER_COMMENT}${notebook.id}`;
  let content = notebook.cell_order
    .map((cell_id) => {
      let cell = notebook.cells[cell_id];
      return `${DELIMITER_COMMENT}${cell.id}\n${cell.unsaved_code}\n`;
    })
    .join("\n");

  return header_line + content + footer_line;
};

let SubNotebook = ({ from, to, notebook: _notebook }) => {
  let view = useEditorView();
  console.log(`view:`, view);
  console.log(`from:`, from);
  console.log(`to:`, to);
  console.log(`_notebook:`, _notebook);

  // let notebook_from_content = script_to_notebook(content);

  let self_ref = React.useRef(/** @type {any} */ (null));

  let notebook = useImmerStore([
    _notebook,
    (
      /** @type {(notebook: import("../../App").Notebook) => import("../../App").Notebook} */ fn
    ) => {
      let new_notebook = produce(_notebook, fn);
      // @ts-ignore
      let new_script = notebook_to_script(new_notebook);
      console.log(`new_script:`, new_script);

      view.dispatch({
        changes: {
          from: from,
          to: to,
          insert: new_script,
        },
      });
    },
  ]);

  return (
    <SubNotebookStyle ref={self_ref}>
      {notebook.cell_order.map((cell_id) => (
        <Cell
          key={cell_id}
          cylinder={{
            last_run: -Infinity,
            result: null,
            running: false,
          }}
          cell={notebook.cells[cell_id]}
          notebook={notebook}
          onSave={() => {}}
        />
      ))}
    </SubNotebookStyle>
  );
};
let SubNotebookStyle = styled.div`
  /* border: solid 3px white; */
  margin-left: 40px;
  width: calc(100% - 50px);

  & > div {
    padding-bottom: 0;
    margin-bottom: 1rem;
  }
  & > div::after {
    content: unset;
  }
`;

let get_decorations = (
  /** @type {EditorState} */ state,
  /** @type {Array<Range<Decoration>>} */ previous_decorations
) => {
  /** @type {Array<Range<Decoration>>} */
  let decorations = [];

  /**
   * @type {{
   *  id: string,
   *  cells: Array<{ id: import("../../App").CellId, code: Array<string> }>,
   *  from: number,
   * } | null}
   */
  let current_subnotebook = /** @type {any} */ (null);
  let current_indentation = "";
  let cursor = 0;
  /** @type {import("../../App").CellId | null} */
  for (let line of state.doc.iterLines()) {
    cursor += line.length + 1;

    if (current_subnotebook != null) {
      console.log("IN NOTEBOOK");
      let current_cell = last(current_subnotebook.cells);

      // In subnotebook parsing, subtract the indentation from the line
      if (!line.startsWith(current_indentation)) {
        if (line === "") {
          // But it is empty! So we fine!
          if (current_cell != null) {
            current_cell.code.push(line);
          } else {
            // Blegh
          }
          continue;
        }

        // OOps! indentation went wrong, so we abort!
        current_subnotebook = null;
        current_indentation = "";
      } else {
        let line_without_indentation = line.slice(current_indentation.length);
        // Look for delimiter or footer comments
        console.log(`line_without_indentation:`, line_without_indentation);
        if (line_without_indentation.startsWith(DELIMITER_COMMENT)) {
          // Found a delimiter comment, so we start a new cell
          let cell_id = line.slice(DELIMITER_COMMENT.length);
          current_subnotebook.cells.push({
            id: cell_id,
            code: [],
          });
          continue;
        } else if (line_without_indentation.startsWith(FOOTER_COMMENT)) {
          let notebook = /** @type {import("../../App").Notebook} */ ({
            cell_order: current_subnotebook.cells.map((cell) => cell.id),
            cells: Object.fromEntries(
              current_subnotebook.cells.map((cell) => [
                cell.id,
                /** @type {Cell} */ ({
                  id: cell.id,
                  code: cell.code.join("\n"),
                  last_run: -Infinity,
                  unsaved_code: cell.code.join("\n"),
                }),
              ])
            ),
          });
          decorations.push(
            Decoration.replace({
              block: true,
              widget: new ReactWidget(
                (
                  <SubNotebook
                    from={current_subnotebook.from}
                    to={cursor - 1}
                    notebook={notebook}
                  />
                )
              ),
              inclusive: false,
            }).range(current_subnotebook.from, cursor - 1)
          );
          current_subnotebook = null;
          current_indentation = "";
        } else if (current_cell != null) {
          // No delimiter, but we got a cell in progress, so we add the line to the cell
          current_cell.code.push(line_without_indentation);
          continue;
        }
      }
    }

    // Check if line starts with HEADER_COMMENT possibly prepended by indentation
    // Also get how much indentation it is (tabs for indentation for now)
    let indentation = line.match(/^\t*/)?.[0]?.length ?? 0;
    let line_without_indentation = line.slice(indentation);
    console.log(`line_without_indentation:`, line_without_indentation);
    if (line_without_indentation.startsWith(HEADER_COMMENT)) {
      // Header comment found.
      // We create a new subnotebook, but `current_cell_id` is still null.
      // If there is anything but a DELIMITER_COMMENT on the next line, we abort.
      let notebook_id = line_without_indentation.slice(HEADER_COMMENT.length);
      current_subnotebook = {
        id: notebook_id,
        cells: [],
        from: cursor - (line.length + 1), // Beginning of this line
      };
      current_indentation = "\t".repeat(indentation);
    }
  }
  // NOTE Iterating with cursor is fun and all, but also error prone.
  // .... Because it can depend on content before it to know if it is
  // .... a label, or actually an object property, for example...
  // .... Going back to searching for comments.. :/
  // let tree = syntaxTree(state);
  // iterate_with_cursor({
  //   tree: tree,
  //   enter: (cursor) => {
  //     if (cursor.name === "LabeledStatement") {
  //       let label = cursor.node.firstChild;
  //       console.log(`cursor.toString():`, label?.toString?.());
  //       let label_name = state.sliceDoc(label?.from, label.to);
  //       console.log(`label_name:`, label_name);
  //       let node = cursor.node;
  //       if (
  //         label_name === "notebook" &&
  //         node.lastChild?.name === "Block" &&
  //         node.lastChild?.firstChild?.name === "{" &&
  //         node.lastChild?.lastChild?.name === "}" &&
  //         state.sliceDoc(cursor.to, cursor.to + 1) === "\n"
  //         // state.sliceDoc(cursor.from - 1, cursor.from) === "\n"
  //       ) {
  //         let content_from = node.lastChild.firstChild.to;
  //         let content_to = node.lastChild.lastChild.from;

  //         decorations.push(
  //           Decoration.replace({
  //             block: true,
  //             widget: new ReactWidget(
  //               (
  //                 <SubNotebook
  //                   from={content_from}
  //                   to={content_to}
  //                   content={state.sliceDoc(content_from, content_to)}
  //                 />
  //               )
  //             ),
  //             inclusive: false,
  //           }).range(cursor.from, cursor.to)
  //         );
  //       }
  //     }
  //   },
  // });

  decorations.map((x) => x.value);

  return decorations;
};

let decorations = StateField.define({
  create(state) {
    return get_decorations(state, []);
  },
  update(previous, tr) {
    if (tr.docChanged) {
      return get_decorations(tr.state, previous);
    } else {
      return previous;
    }
  },
  provide: (field) =>
    EditorView.decorations.from(field, (x) => Decoration.set(x)),
});

let only_show_actually_selected_cursor = EditorView.baseTheme({
  ".cm-editor > * > .cm-cursorLayer": {
    display: "none !important",
  },
  ".cm-editor.cm-focused > * > .cm-cursorLayer": {
    display: "block !important",
  },
});

export let inline_notebooks_extension = [
  decorations,
  only_show_actually_selected_cursor,
];
