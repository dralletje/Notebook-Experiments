import React from "react";
import { basic_css_extensions } from "./codemirror-css-setup";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import {
  useViewUpdate,
  CodemirrorFromViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { produce as immer } from "immer";
import { v4 as uuidv4 } from "uuid";

import { EditorState } from "@codemirror/state";
import { indentLess, indentMore } from "@codemirror/commands";
import { Facet, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { groupBy, isEqual } from "lodash";

import "./editor.css";
import "./dark_color.css";
import "./App.css";

import {
  ActiveSelector,
  pkgBubblePlugin,
} from "./Codemirror/CssSelectorHighlight";

let Cell = styled.div`
  &.modified {
    /* outline: solid 4px #f0f0f0; */
    /* background-color: #432b00; */
    background-color: #052f1e;
  }

  &.disabled {
    filter: contrast(0.4);
  }
`;

let AddCellButtonStyle = styled.button`
  all: unset;

  padding-bottom: 3px;
  padding-left: 12px;
  padding-right: 12px;
  margin: 3px;

  cursor: pointer;
  border-radius: 8px;
  background-color: transparent;
  transition: background-color 0.2s;

  & .hidden-till-hover {
    font-size: 0.9rem;
    opacity: 0;
    transition: opacity 0.2s;
  }
  &:hover .hidden-till-hover {
    opacity: 1;
  }

  &:hover {
    background-color: #ffffff1f;
  }
`;
let AddCellButton = ({ onClick }) => {
  return (
    <AddCellButtonStyle onClick={onClick}>
      + <span className="hidden-till-hover">add cell</span>
    </AddCellButtonStyle>
  );
};

/** @type {Facet<string, string>} */
let CellIdFacet = Facet.define({
  combine: (x) => x[0],
});

let empty_cell = () => {
  return {
    id: uuidv4(),
    code: "",
  };
};

/**
 * @param {{
 *  initial_code: string,
 *  children: React.ReactNode,
 * }} props
 */
export const CellInput = ({ initial_code, children }) => {
  let initial_state = React.useMemo(() => {
    return EditorState.create({
      doc: initial_code,
      extensions: basic_css_extensions,
    });
  }, []);

  let [editor_state, set_editor_state] = React.useState(initial_state);

  let viewupdate = useViewUpdate(editor_state, set_editor_state);

  return (
    <CodemirrorFromViewUpdate as="pluto-input" viewupdate={viewupdate}>
      {children}
    </CodemirrorFromViewUpdate>
  );
};

let NotebookHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 16px 16px;
  /* position: sticky; */
  top: 0;
  z-index: 1;
  background-color: var(--main-bg-color);

  border-radius: 10px 10px 0 0;
`;

let CellHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  /* padding-top: 8px; */
  position: sticky;
  top: 0;
  background-color: var(--main-bg-color);
  z-index: 2;
`;

/**
 * @typedef Cell
 * @type {{
 *  id: string,
 *  code: string,
 *  disabled?: boolean,
 *  collapsed?: boolean,
 *  name?: string,
 * }}
 */

let CellHeaderButton = styled.button`
  all: unset;
  border-radius: 100px;
  background-color: transparent;
  transition: background-color 0.2s;
  padding: 2px 16px;

  &:hover {
    background-color: #ffffff1f;
  }
`;

let NameInput = styled.input.attrs({ type: "text" })`
  all: unset;
  font-size: 1rem;
  padding: 4px 8px;
  color: white;
  width: 100%;

  margin-bottom: 4px;
  font-size: 1.3rem;
`;

let classes = (obj) => {
  return Object.entries(obj)
    .filter(([key, value]) => value)
    .map(([key, value]) => key)
    .join(" ");
};

/**
 * @typedef PaintbrushIframeCommand
 * @type {never
 *  | { type: "highlight_selector", selector: string | undefined }
 *  | { type: "save", cells: Cell[] }
 *  | { type: "toggle-horizontal-position" }
 *  | { type: 'css', code: string }
 *  | { type: "load" }
 *  | { type: "ready" }
 * }
 */

/**
 * `window.parent.postMessage` but with types so
 * I know I am not screwing things up too much.
 *
 * @param {PaintbrushIframeCommand} message
 */
let post_command = (message) => {
  window.parent.postMessage(message, "*");
};

/**
 * @param {{
 *   cells: Cell[],
 *   currently_saved_cells: Cell[],
 *   set_cells: (cells: Cell[]) => void,
 *   set_currently_saved_cells: (cells: Cell[]) => void,
 * }} props
 */
function Editor({
  cells,
  currently_saved_cells,
  set_cells,
  set_currently_saved_cells,
}) {
  React.useEffect(() => {
    post_command({ type: "ready" });
  }, []);

  let cell_keymap = React.useMemo(() => {
    return Prec.high(
      keymap.of([
        {
          key: "Backspace",
          run: (view) => {
            // If cell is empty, remove it
            if (view.state.doc.toString() === "") {
              let current_cell_id = view.state.facet(CellIdFacet);
              let new_cells = cells.filter(
                (cell) => cell.id !== current_cell_id
              );
              set_currently_saved_cells(new_cells);
              return true;
            }
            return false;
          },
        },
        {
          key: "Shift-Enter",
          run: () => {
            // on_submit();
            console.log("Submit");
            return true;
          },
        },
        {
          key: "Ctrl-Enter",
          mac: "Cmd-Enter",
          run: () => {
            // Add a new cell below
            // on_submit();
            console.log("Submit and add cell below");
            return true;
          },
        },
        {
          key: "Tab",
          run: indentMore,
          shift: indentLess,
        },
        {
          key: "Ctrl-s",
          mac: "Cmd-s",
          run: () => {
            set_currently_saved_cells(cells);
            return true;
          },
        },
      ])
    );
  }, [set_currently_saved_cells, cells]);

  let send_selector_to_highlight_extension = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (
        update.state.field(ActiveSelector, false) !==
        update.startState.field(ActiveSelector, false)
      ) {
        let cool = update.state.field(ActiveSelector, false);
        post_command({
          type: "highlight_selector",
          selector: cool?.selector,
        });
      }
    });
  }, []);

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "s" && event.metaKey) {
          event.preventDefault();
          set_currently_saved_cells(cells);
        }
      }}
    >
      <NotebookHeader>
        <h1>Paintbrush</h1>

        <button
          onClick={() => {
            post_command({ type: "toggle-horizontal-position" });
          }}
        >
          s
        </button>
      </NotebookHeader>

      {cells.map((cell, cell_index) => {
        let { code, id, name = "", disabled = false, collapsed = false } = cell;
        let currently_saved_version = currently_saved_cells.find(
          (x) => x.id === id
        );
        return (
          <React.Fragment key={id}>
            <Cell
              className={classes({
                modified: !isEqual(cell, currently_saved_version),
                disabled: disabled,
              })}
            >
              <CellHeader>
                <NameInput
                  placeholder="my browser, my style"
                  value={name}
                  onChange={({ target: { value } }) => {
                    set_cells(
                      cells.map((x, i) =>
                        i === cell_index ? { ...x, name: value } : x
                      )
                    );
                  }}
                />
                <CellHeaderButton
                  style={{
                    color: disabled ? "red" : "rgba(255,255,255,.5)",
                  }}
                  onClick={() => {
                    let new_cells = cells.map((x, i) =>
                      i === cell_index ? { ...x, disabled: !x.disabled } : x
                    );
                    set_cells(new_cells);
                  }}
                >
                  {disabled ? "disabled" : "active"}
                </CellHeaderButton>
                <CellHeaderButton
                  style={{
                    color: collapsed
                      ? "rgba(255,255,255,1)"
                      : "rgba(255,255,255,.5)",
                  }}
                  onClick={() => {
                    let new_cells = cells.map((x, i) =>
                      i === cell_index ? { ...x, collapsed: !x.collapsed } : x
                    );
                    set_cells(new_cells);
                  }}
                >
                  {collapsed ? "open" : "close"}
                </CellHeaderButton>
                <div style={{ width: 8 }} />
              </CellHeader>

              <div style={{ display: collapsed ? "none" : "block" }}>
                <CellInput initial_code={code}>
                  <Extension extension={placeholder("Style away!")} />
                  <Extension extension={cell_keymap} />
                  <Extension extension={CellIdFacet.of(id)} />
                  <Extension extension={pkgBubblePlugin()} />
                  <Extension extension={send_selector_to_highlight_extension} />

                  <Extension
                    extension={EditorView.updateListener.of((update) => {
                      if (update.docChanged) {
                        let new_code = update.state.doc.toString();
                        let new_cells = immer(cells, (cells) => {
                          for (let cell of cells) {
                            if (cell.id === id) {
                              cell.code = new_code;
                            }
                          }
                        });
                        set_cells(new_cells);
                      }
                    })}
                  />
                </CellInput>
              </div>
            </Cell>
            <AddCellButton
              onClick={() => {
                set_currently_saved_cells([
                  ...cells.slice(0, cell_index + 1),
                  empty_cell(),
                  ...cells.slice(cell_index + 1),
                ]);
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** @param {Array<Cell>} cells */
let send_cells = (cells) => {
  post_command({
    type: "css",
    code: cells
      .filter((x) => !x.disabled)
      .map((x) => x.code)
      .join("\n\n"),
  });
};

let App = () => {
  let [currently_saved_cells, set_currently_saved_cells] = React.useState(
    /** @type {Array<Cell>?} */ (null)
  );
  let [cells, set_cells] = React.useState(/** @type {Array<Cell>?} */ (null));

  React.useEffect(() => {
    post_command({ type: "load" });
    window.addEventListener("message", (message) => {
      if (message.source !== window.parent) return;
      if (message.data?.type === "load") {
        let cells_we_got_back = message.data.cells ?? [];
        let cells =
          cells_we_got_back.length === 0 ? [empty_cell()] : cells_we_got_back;

        set_currently_saved_cells(cells);
        set_cells(cells);
      }
    });
  }, []);

  let set_cells_and_send = React.useCallback(
    (/** @type {Array<Cell>} */ cells) => {
      set_cells(cells);
      send_cells(cells);
    },
    [set_cells, send_cells]
  );

  let set_currently_saved_cells_and_send = React.useCallback(
    (/** @type {Array<Cell>} */ cells) => {
      set_currently_saved_cells(cells);
      set_cells_and_send(cells);
      post_command({ type: "save", cells });
    },
    [set_currently_saved_cells]
  );

  if (cells == null || currently_saved_cells == null) {
    return null;
  }

  return (
    <EditorBox>
      <Editor
        cells={cells}
        set_cells={set_cells_and_send}
        currently_saved_cells={currently_saved_cells}
        set_currently_saved_cells={set_currently_saved_cells_and_send}
      />
    </EditorBox>
  );
};

let EditorBox = styled.div`
  position: fixed;
  right: 16px;
  bottom: 0px;
  height: max(60vh, min(500px, 100vh));
  width: max(20vw, 400px);
  overflow: "auto";

  background-color: black;
  outline: solid 1px #ffffff33;
  border-radius: 10px 10px 0 0;
  /* transform: translateX(calc(100% + 16px)); */
  transition: transform 0.5s;
`;

export default App;
