import React from "react";
import { basic_css_extensions } from "./codemirror-css-setup";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import {
  useViewUpdate,
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { produce as immer } from "immer";
import { v4 as uuidv4 } from "uuid";

import { EditorState } from "@codemirror/state";
import { indentLess, indentMore, invertedEffects } from "@codemirror/commands";
import {
  Facet,
  Prec,
  StateField,
  StateEffect,
  StateEffectType,
} from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";

import "./App.css";
import "./editor.css";

import {
  ActiveSelector,
  pkgBubblePlugin,
} from "./Codemirror/CssSelectorHighlight";
import { EditorInChief } from "./codemirror-editor-in-chief/editor-in-chief-state";
import { extract_nested_viewupdate } from "./codemirror-editor-in-chief/extract-nested-viewupdate";
import { useCodemirrorKeyhandler } from "./use/use-codemirror-keyhandler";
import {
  historyKeymap,
  shared_history,
} from "./codemirror-editor-in-chief/codemirror-shared-history";
import {
  EditorDispatchEffect,
  EditorInChiefKeymap,
} from "./codemirror-editor-in-chief/editor-in-chief";
import { isEqual } from "lodash";

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
 *   viewupdate: GenericViewUpdate<EditorInChief<EditorState>>,
 * }} props
 */
function Editor({ viewupdate }) {
  React.useEffect(() => {
    post_command({ type: "ready" });
  }, []);

  useCodemirrorKeyhandler(viewupdate);

  // let cell_keymap = React.useMemo(() => {
  //   return Prec.high(
  //     keymap.of([
  //       {
  //         key: "Backspace",
  //         run: (view) => {
  //           // If cell is empty, remove it
  //           if (view.state.doc.toString() === "") {
  //             let current_cell_id = view.state.facet(CellIdFacet);
  //             let new_cells = cells.filter(
  //               (cell) => cell.id !== current_cell_id
  //             );
  //             set_currently_saved_cells(new_cells);
  //             return true;
  //           }
  //           return false;
  //         },
  //       },
  //       {
  //         key: "Shift-Enter",
  //         run: () => {
  //           // on_submit();
  //           console.log("Submit");
  //           return true;
  //         },
  //       },
  //       {
  //         key: "Ctrl-Enter",
  //         mac: "Cmd-Enter",
  //         run: () => {
  //           // Add a new cell below
  //           // on_submit();
  //           console.log("Submit and add cell below");
  //           return true;
  //         },
  //       },
  //       {
  //         key: "Tab",
  //         run: indentMore,
  //         shift: indentLess,
  //       },
  //       {
  //         key: "Ctrl-s",
  //         mac: "Cmd-s",
  //         run: () => {
  //           set_currently_saved_cells(cells);
  //           return true;
  //         },
  //       },
  //     ])
  //   );
  // }, [set_currently_saved_cells, cells]);

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
        // if (event.key === "s" && event.metaKey) {
        //   event.preventDefault();
        //   set_currently_saved_cells(cells);
        // }
        // TODO Send keypress to editor in chief
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

      {viewupdate.state.editors
        .mapValues((_, cell_index) => {
          let cell_update = extract_nested_viewupdate(viewupdate, cell_index);
          let cell = cell_update.state;

          let {
            code,
            name = "",
            enabled,
            folded: collapsed = false,
          } = cell.field(CellMetaField);
          let id = cell.facet(CellIdFacet);
          let disabled = !enabled;

          return (
            <React.Fragment key={id}>
              <Cell
                className={classes({
                  modified: cell.doc.toString() !== code,
                  disabled: disabled,
                })}
              >
                <CellHeader>
                  <NameInput
                    placeholder="my browser, my style"
                    value={name}
                    onChange={({ target: { value } }) => {
                      // @ts-ignore
                      cell_update.view.dispatch({
                        effects: [
                          MutateCellMetaEffect.of((meta) => {
                            meta.name = value;
                          }),
                        ],
                      });
                      // set_cells(
                      //   cells.map((x, i) =>
                      //     i === cell_index ? { ...x, name: value } : x
                      //   )
                      // );
                    }}
                  />
                  {/* <CellHeaderButton
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
                  </CellHeaderButton> */}
                  <CellHeaderButton
                    style={{
                      color: collapsed
                        ? "rgba(255,255,255,1)"
                        : "rgba(255,255,255,.5)",
                    }}
                    onClick={() => {
                      // @ts-ignore
                      cell_update.view.dispatch({
                        effects: [
                          MutateCellMetaEffect.of((meta) => {
                            meta.folded = !meta.folded;
                          }),
                        ],
                      });
                    }}
                  >
                    {collapsed ? "open" : "close"}
                  </CellHeaderButton>
                  <div style={{ width: 8 }} />
                </CellHeader>

                <div style={{ display: collapsed ? "none" : "block" }}>
                  <CodemirrorFromViewUpdate viewupdate={cell_update}>
                    <Extension
                      extension={placeholder("Style away!")}
                      deps={[]}
                    />
                    {/* <Extension extension={cell_keymap} /> */}
                    <Extension extension={pkgBubblePlugin()} deps={[]} />
                    <Extension
                      extension={send_selector_to_highlight_extension}
                    />
                    <Extension key="basic" extension={basic_css_extensions} />
                  </CodemirrorFromViewUpdate>
                </div>
              </Cell>
              {/* <AddCellButton
                onClick={() => {
                  set_currently_saved_cells([
                    ...cells.slice(0, cell_index + 1),
                    empty_cell(),
                    ...cells.slice(cell_index + 1),
                  ]);
                }}
              /> */}
            </React.Fragment>
          );
        })
        .values()
        .toArray()}
    </div>
  );
}

/**
 * @typedef CellMeta
 * @type {{
 *  name: string,
 *  code: string,
 *  folded: boolean,
 *  enabled: boolean,
 * }}
 */

/** @type {StateEffectType<(value: CellMeta) => void>} */
let MutateCellMetaEffect = StateEffect.define();
let invert_fold = invertedEffects.of((tr) => {
  let was = tr.startState.field(CellMetaField).folded;
  let is = tr.state.field(CellMetaField).folded;
  if (was !== is) {
    return [
      MutateCellMetaEffect.of((meta) => {
        meta.folded = was;
      }),
    ];
  } else {
    return [];
  }
});
let CellMetaField = StateField.define({
  create() {
    return /** @type {CellMeta} */ ({
      code: "",
      name: "",
      enabled: true,
      folded: false,
    });
  },
  update(value, transaction) {
    return immer(value, (value) => {
      for (let effect of transaction.effects) {
        if (effect.is(MutateCellMetaEffect)) {
          // @ts-ignore
          effect.value(value);
        }
      }
    });
  },
  provide: () => invert_fold,
});

let create_cell_state = (
  /** @type {EditorInChief<EditorState>} */ editorstate,
  /** @type {Cell} */ cell
) => {
  return editorstate.create_section_editor({
    editor_id: /** @type {any} */ (cell.id),
    doc: cell.code,
    extensions: [
      CellIdFacet.of(cell.id),
      CellMetaField.init(() => ({
        name: cell.name ?? "",
        code: cell.code,
        folded: !!cell.collapsed,
        enabled: !cell.disabled,
      })),
    ],
  });
};

let save_on_save = EditorInChiefKeymap.of([
  {
    key: "Mod-s",
    run: ({ state, dispatch }) => {
      dispatch({
        effects: state.editors
          .entries()
          .map(([id, state]) => {
            return EditorDispatchEffect.of({
              editor_id: id,
              transaction: {
                effects: [
                  MutateCellMetaEffect.of((meta) => {
                    meta.code = state.doc.toString();
                  }),
                ],
              },
            });
          })
          .toArray(),
      });

      return true;
    },
  },
]);

let notebook_to_editorinchief = (
  /** @type {Cell[]} */ cells,
  extensions = []
) => {
  return EditorInChief.create({
    editors: (editorstate) => {
      return Object.fromEntries(
        cells.map((cell) => [cell.id, create_cell_state(editorstate, cell)])
      );
    },
    extensions: [
      extensions,

      save_on_save,

      // create_codemirror_notebook(notebook),
      // This works so smooth omg
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
    ],
  });
};

/** @param {EditorInChief<EditorState>} state */
let editorinchief_to_css = (state) => {
  return state.editors
    .filter((x) => x.field(CellMetaField).enabled)
    .values()
    .toArray()
    .map((x) => x.doc)
    .join("\n\n");
};

/**
 * @param {EditorInChief<EditorState>} state
 * @returns {Cell[]}
 * */
let editorinchief_to_serialized = (state) => {
  return state.editors
    .values()
    .toArray()
    .map((x) => {
      let meta = x.field(CellMetaField);
      return {
        code: meta.code,
        name: meta.name,
        id: x.facet(CellIdFacet),
        collapsed: meta.folded,
        disabled: !meta.enabled,
      };
    });
};

/**
 * @param {{
 *  state: EditorInChief<EditorState>,
 *  set_state: (state: EditorInChief<EditorState>) => void,
 * }} props
 */
let AppWhenLoaded = ({ state, set_state }) => {
  let viewupdate = useViewUpdate(state, set_state);

  React.useEffect(() => {
    let code_now = editorinchief_to_css(viewupdate.state);
    let code_prev = editorinchief_to_css(viewupdate.startState);

    if (code_now !== code_prev) {
      post_command({
        type: "css",
        code: code_now,
      });
    }
  }, [viewupdate]);

  React.useEffect(() => {
    let cells_now = editorinchief_to_serialized(viewupdate.state);
    let cells_prev = editorinchief_to_serialized(viewupdate.startState);

    if (!isEqual(cells_now, cells_prev)) {
      post_command({ type: "save", cells: cells_now });
    }
  }, [viewupdate]);

  return (
    <EditorBox>
      <Editor viewupdate={viewupdate} />
    </EditorBox>
  );
};

let App = () => {
  let [state, set_state] = React.useState(/** @type {any} */ (null));
  React.useEffect(() => {
    post_command({ type: "load" });
    window.addEventListener("message", (message) => {
      if (message.source !== window.parent) return;
      if (message.data?.type === "load") {
        let cells_we_got_back = message.data.cells ?? [];
        let cells =
          cells_we_got_back.length === 0 ? [empty_cell()] : cells_we_got_back;

        set_state(notebook_to_editorinchief(cells));
      }
    });
  }, []);

  if (state == null) {
    return null;
  }
  return <AppWhenLoaded state={state} set_state={set_state} />;
};

let EditorBox = styled.div`
  position: fixed;
  right: 16px;
  bottom: 0px;
  height: max(60vh, min(500px, 100vh));
  width: max(20vw, 400px);
  overflow: "auto";

  background-color: rgb(24 24 24);
  outline: solid 1px #ffffff33;
  border-radius: 10px 10px 0 0;
  /* transform: translateX(calc(100% + 16px)); */
  transition: transform 0.5s;
`;

export default App;
