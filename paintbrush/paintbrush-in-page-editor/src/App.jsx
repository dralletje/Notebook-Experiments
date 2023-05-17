import "./App.css";
import { useEditorState } from "./Codemirror";
import styled from "styled-components";
import { CodeMirror, Extension } from "codemirror-x-react";
import React from "react";
import immer from "immer";
import { v4 as uuidv4 } from "uuid";

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
  /* border-radius: 20px 20px 0 0; */

  &.modified {
    /* outline: solid 4px #f0f0f0; */
    /* background-color: #432b00; */
    background-color: #052f1e;
  }

  &.disabled {
    filter: contrast(0.4);
  }
`;

let Partytime = () => {
  React.useEffect(() => {
    window.parent.postMessage(
      {
        type: "ready",
      },
      "*"
    );
  }, []);
  return null;
};

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

function useEvent(handler) {
  const handlerRef = React.useRef(null);

  // In a real implementation, this would run before layout effects
  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return React.useCallback((...args) => {
    // In a real implementation, this would throw if called during render
    const fn = handlerRef.current;
    return fn(...args);
  }, []);
}

/**
 * @param {{
 *  value: string,
 *  onChange?: (code: string) => void,
 *  children: React.ReactNode,
 * }} props
 */
export const CellInput = ({ value, onChange, children }) => {
  let editor_state = useEditorState({
    code: value,
  });

  let on_change_extension = React.useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange?.(update.state.doc.toString());
      }
    });
  }, []);

  return (
    <CodeMirror as="pluto-input" state={editor_state}>
      <Extension extension={on_change_extension} />
      {children}
    </CodeMirror>
  );
};

let NotebookHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 16px 16px;
  /* position: sticky; */
  top: 0;
  z-index: 1000000;
  background-color: var(--main-bg-color);

  border-radius: 10px 10px 0 0;
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

let StickyHeader = styled.div`
  /* position: sticky;
  top: 0; */
  z-index: 1000000;
  background-color: var(--main-bg-color);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

function Editor() {
  let [currently_saved_cells, set_currently_saved_cells] = React.useState(
    /** @type {Array<Cell>?} */ (null)
  );
  let [cells, set_cells] = React.useState(/** @type {Array<Cell>?} */ (null));

  React.useEffect(() => {
    window.parent.postMessage({ type: "load" }, "*");
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
              set_cells(new_cells);
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
            console.log("AAA");
            set_currently_saved_cells(cells);
            window.parent.postMessage({ type: "save", cells }, "*");
            return true;
          },
        },
      ])
    );
  }, [set_currently_saved_cells, cells]);

  console.log("cells:", cells);
  if (cells == null) {
    return null;
  }

  /** @param {Array<Cell>} cells */
  let send_cells = (cells) => {
    window.parent.postMessage(
      {
        type: "css",
        code: cells
          .filter((x) => !x.disabled)
          .map((x) => x.code)
          .join("\n\n"),
      },
      "*"
    );
  };

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "s" && event.metaKey) {
          event.preventDefault();
          set_currently_saved_cells(cells);
          window.parent.postMessage({ type: "save", cells }, "*");
        }
      }}
    >
      <NotebookHeader>
        <h1>Paintbrush</h1>

        <button
          onClick={() => {
            window.parent.postMessage(
              { type: "toggle-horizontal-position" },
              "*"
            );
          }}
        >
          s
        </button>
      </NotebookHeader>

      <StickyHeader style={{ position: "sticky", top: 0 }}></StickyHeader>

      <Partytime />

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
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  // paddingTop: 8,
                  position: "sticky",
                  // top: 38 + 16 + 16,
                  top: 0,
                  backgroundColor: `var(--main-bg-color)`,
                  zIndex: 10000,
                }}
              >
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
                    send_cells(new_cells);
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
                    send_cells(new_cells);
                    set_cells(new_cells);
                  }}
                >
                  {collapsed ? "open" : "close"}
                </CellHeaderButton>
                <div style={{ width: 8 }} />
              </div>

              <div style={{ display: collapsed ? "none" : "block" }}>
                <CellInput value={code}>
                  <Extension extension={placeholder("Style away!")} />
                  <Extension extension={cell_keymap} />
                  <Extension extension={CellIdFacet.of(id)} />
                  <Extension extension={pkgBubblePlugin()} />
                  <Extension
                    extension={EditorView.updateListener.of((update) => {
                      if (
                        update.state.field(ActiveSelector, false) !==
                        update.startState.field(ActiveSelector, false)
                      ) {
                        let cool = update.state.field(ActiveSelector, false);
                        window.parent.postMessage(
                          {
                            type: "highlight_selector",
                            selector: cool?.selector,
                          },
                          "*"
                        );
                      }
                    })}
                  />

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
                        send_cells(new_cells);
                        set_cells(new_cells);
                      }
                    })}
                  />

                  <Extension
                    extension={EditorView.updateListener.of((update) => {
                      // Add react portals
                    })}
                  />
                </CellInput>
              </div>
            </Cell>
            <AddCellButton
              onClick={() => {
                set_cells([
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

let App = () => {
  // These two are just for tracking if the mouse is on the visible part of this iframe.
  // If it is, we are fine. If it isn't, we have to yield control back to the parent page.
  // The parent page will then set pointer-events: none on the iframe, and call `maybe enable again?` on mousemove
  // to give us a chance to take back control.
  React.useEffect(() => {
    let handler = (/** @type {MouseEvent} */ event) => {
      let element = document.elementFromPoint(event.clientX, event.clientY);
      if (element == null || element.tagName === "HTML") {
        window.parent.postMessage({ type: "disable me!" }, "*");
      }
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  });
  React.useEffect(() => {
    let handler = (/** @type {MessageEvent} */ message) => {
      if (message.source !== window.parent) return;
      if (message.data?.type === "maybe enable again?") {
        let element = document.elementFromPoint(message.data.x, message.data.y);
        if (element != null && element.tagName !== "HTML") {
          window.parent.postMessage({ type: "enable me!" }, "*");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  return (
    <EditorBox>
      <Editor />
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
