import React from "react";
import { basic_css_extensions } from "./codemirror-css-setup";
import styled from "styled-components";
import { Extension } from "codemirror-x-react";
import {
  useViewUpdate,
  CodemirrorFromViewUpdate,
  GenericViewUpdate,
} from "codemirror-x-react/viewupdate.js";
import { v4 as uuidv4 } from "uuid";

import { EditorSelection, EditorState } from "@codemirror/state";
import { placeholder } from "@codemirror/view";

import {
  ActiveSelector,
  pkgBubblePlugin,
} from "./codemirror-css/CssSelectorHighlight";
import { EditorInChief } from "./codemirror-editor-in-chief/editor-in-chief-state";
import { extract_nested_viewupdate } from "./codemirror-editor-in-chief/extract-nested-viewupdate";
import { useCodemirrorKeyhandler } from "./use/use-codemirror-keyhandler";
import {
  historyKeymap,
  shared_history,
} from "./codemirror-editor-in-chief/codemirror-shared-history";
import {
  BlurEditorInChiefEffect,
  EditorAddEffect,
  EditorDispatchEffect,
  EditorExtension,
  EditorHasSelectionField,
  EditorIdFacet,
  EditorInChiefKeymap,
} from "./codemirror-editor-in-chief/editor-in-chief";
import { isEqual } from "lodash";
import { decorate_colors } from "./codemirror-css/ColorHighlight";
import dedent from "string-dedent";
import {
  css_variable_completions,
  css_variables_facet,
} from "./codemirror-css/css-variable-completions";

import { CellOrderField } from "./codemirror-notebook/cell-order";
import { cell_movement_extension } from "./codemirror-notebook/cell-movement";
import { cell_keymap } from "./codemirror-notebook/add-move-and-run-cells";
import { create_empty_cell_facet } from "./codemirror-notebook/config";
import { CellMetaField, MutateCellMetaEffect } from "./cell-meta";
import { add_single_cell_when_all_cells_are_removed } from "./codemirror-notebook/add-cell-when-last-is-removed";

import "./App.css";
import "./editor.css";

import { RxCrossCircled, RxEyeClosed, RxEyeOpen } from "react-icons/rx";

let Cell = styled.div`
  &.modified {
    background-color: #052f1e;
  }

  &.disabled {
    /* filter: contrast(0.4); */
    opacity: 0.5;
  }

  &.disabled.modified {
    /* background-color: #052f1e; */
  }
`;

let NotebookHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  padding: 4px 6px 4px;
  color: #a16fff;
  background-color: rgb(45 16 93);
  border-radius: 10px 10px 0px 0px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);

  position: sticky;
  top: 0;
  z-index: 3;

  h1 {
    font-size: 1em;
    font-weight: bold;
  }
`;

let CellHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  /* padding-top: 8px; */
  position: sticky;
  top: 28px;

  z-index: 2;
  backdrop-filter: blur(10px);
  border-bottom: solid 1px #ffffff12;
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
  padding: 2px 12px;

  &:hover {
    background-color: #ffffff1f;
  }
`;

let NameInput = styled.input.attrs({ type: "text" })`
  all: unset;
  font-size: 1rem;
  padding: 4px 16px;
  padding-left: 10px;

  color: white;
  width: 100%;

  margin-bottom: 4px;
  font-size: 1.1rem;
  margin-top: 4px;
  font-weight: bold;

  text-overflow: ellipsis;

  /* .disabled & {
    text-decoration: line-through;
  } */
`;

let classes = (obj) => {
  return Object.entries(obj)
    .filter(([key, value]) => value)
    .map(([key, value]) => key)
    .join(" ");
};

/**
 * @typedef PaintbrushIframeCommandMap
 * @type {{
 *  highlight_selector: {
 *    "input": { selector: string | undefined },
 *  },
 *  save: {
 *    "input": { cells: Cell[] },
 *  },
 *  "toggle-horizontal-position": { "input": void },
 *  css: {
 *    "input": { code: string },
 *  },
 *  "apply-new-css": { "input": { sheets: Cell[] } },
 *  load: {
 *    "input": void,
 *    "output": Cell[],
 *  },
 *  ready: { "input": void },
 *  close: { "input": void },
 *  reload: { "input": void },
 *  "get-css-variables": { "input": {}, "output": { variables: { key: string, value: string }[] } },
 * }}
 */

let message_counter = 1;

/**
 * `window.parent.postMessage` but with types so
 * I know I am not screwing things up too much.
 *
 * @template {keyof PaintbrushIframeCommandMap} K
 * @param {K} type
 * @param {PaintbrushIframeCommandMap[K]["input"]} [argument]
 * @returns {Promise<PaintbrushIframeCommandMap[K]["output"]>}
 */
let call_extension = (type, argument) => {
  let message_id = message_counter++;
  window.parent.postMessage(
    {
      ...argument,
      type: type,
      message_id: message_id,
    },
    "*"
  );

  return new Promise((resolve) => {
    window.addEventListener("message", function listener(event) {
      if (event.source !== window.parent) return;
      if (
        event.data.type === "response" &&
        event.data.message_id === message_id
      ) {
        window.removeEventListener("message", listener);
        resolve(event.data.result);
      }
    });
  });
};

let useCssVariables = () => {
  let [variables, set_variables] = React.useState(
    /** @type {{ key: String, value: string }[]} */ ([])
  );
  React.useEffect(() => {
    call_extension("get-css-variables", {}).then((x) => {
      set_variables(x.variables);
    });
  }, []);
  return variables;
};

/**
 * @param {{
 *   viewupdate: GenericViewUpdate<EditorInChief<{ [k: string]: EditorState }>>,
 * }} props
 */
function Editor({ viewupdate }) {
  React.useEffect(() => {
    call_extension("ready");
  }, []);

  useCodemirrorKeyhandler(viewupdate);
  let variables = useCssVariables();

  let css_variables_facet_value = React.useMemo(() => {
    return css_variables_facet.of(variables);
  }, [variables]);

  return (
    <div>
      {viewupdate.state.field(CellOrderField).map((cell_id) => {
        let cell_update = extract_nested_viewupdate(viewupdate, cell_id);
        let cell = cell_update.state;

        let {
          code,
          name = "",
          enabled,
          folded: collapsed = false,
        } = cell.field(CellMetaField);
        let id = cell.facet(EditorIdFacet);
        let disabled = !enabled;

        let actually_collapsed = cell.field(EditorHasSelectionField)
          ? false
          : collapsed;

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
                    cell_update.view.dispatch({
                      effects: [
                        MutateCellMetaEffect.of((meta) => {
                          meta.name = value;
                        }),
                      ],
                    });
                  }}
                />
                <CellHeaderButton
                  style={{
                    color: disabled ? "red" : "rgba(255,255,255,.5)",
                  }}
                  onClick={() => {
                    cell_update.view.dispatch({
                      effects: [
                        MutateCellMetaEffect.of((meta) => {
                          meta.enabled = !meta.enabled;
                        }),
                      ],
                    });
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

              <div style={{ display: actually_collapsed ? "none" : "block" }}>
                <CodemirrorFromViewUpdate viewupdate={cell_update}>
                  <Extension key="basic" extension={basic_css_extensions} />
                  <Extension extension={placeholder("Style away!")} deps={[]} />
                  <Extension extension={decorate_colors} />
                  <Extension extension={pkgBubblePlugin()} deps={[]} />
                  <Extension extension={css_variables_facet_value} />
                  <Extension extension={css_variable_completions} />
                </CodemirrorFromViewUpdate>
              </div>
            </Cell>
          </React.Fragment>
        );
      })}

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          padding: "8px 16px",
        }}
      >
        <CellHeaderButton
          style={{ color: "gray" }}
          onClick={() => {
            let create_new_cell = viewupdate.state.facet(
              create_empty_cell_facet
            );
            let new_cell = create_new_cell(viewupdate.state, "");
            viewupdate.view.dispatch({
              effects: [
                EditorAddEffect.of({
                  state: new_cell,
                  focus: true,
                }),
              ],
            });
          }}
        >
          add style
        </CellHeaderButton>
      </div>
    </div>
  );
}

let create_cell_state = (
  /** @type {EditorInChief<import("./codemirror-editor-in-chief/editor-in-chief-state").EditorMapping>} */ editorstate,
  /** @type {Cell} */ cell
) => {
  return editorstate.create_section_editor({
    editor_id: /** @type {any} */ (cell.id),
    doc: cell.code,
    selection: EditorSelection.single(0),
    extensions: [
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

      add_single_cell_when_all_cells_are_removed,
      CellOrderField.init(() => cells.map((x) => /** @type {any} */ (x.id))),
      cell_movement_extension,
      EditorExtension.of(cell_keymap),
      create_empty_cell_facet.of((editor_in_chief, code) => {
        return create_cell_state(editor_in_chief, {
          id: uuidv4(),
          code,
          collapsed: false,
          disabled: false,
          name: "",
        });
      }),
      // create_codemirror_notebook(notebook),
      // This works so smooth omg
      [shared_history(), EditorInChiefKeymap.of(historyKeymap)],
    ],
  });
};

/** @param {EditorInChief} state */
let editorinchief_to_sheets = (state) => {
  return state.field(CellOrderField).map((cell_id) => {
    let x = state.editor(cell_id);
    let meta = x.field(CellMetaField);
    return {
      code: x.doc.toString(),
      name: meta.name,
      id: x.facet(EditorIdFacet),
      collapsed: meta.folded,
      disabled: !meta.enabled,
    };
  });
};

/**
 * @param {EditorInChief} state
 * @returns {Cell[]}
 * */
let editorinchief_to_serialized = (state) => {
  return state.field(CellOrderField).map((cell_id) => {
    let x = state.editor(cell_id);
    let meta = x.field(CellMetaField);
    return {
      code: meta.code,
      name: meta.name,
      id: x.facet(EditorIdFacet),
      collapsed: meta.folded,
      disabled: !meta.enabled,
    };
  });
};

/**
 * @param {{
 *  state: EditorInChief,
 *  set_state: (state: EditorInChief) => void,
 * }} props
 */
let AppWhenLoaded = ({ state, set_state }) => {
  let viewupdate = useViewUpdate(state, set_state);

  React.useEffect(() => {
    let code_now = editorinchief_to_sheets(viewupdate.state);
    let code_prev = editorinchief_to_sheets(viewupdate.startState);

    if (code_now !== code_prev) {
      call_extension("apply-new-css", { sheets: code_now });
    }
  }, [viewupdate]);

  React.useEffect(() => {
    let cells_now = editorinchief_to_serialized(viewupdate.state);
    let cells_prev = editorinchief_to_serialized(viewupdate.startState);

    if (!isEqual(cells_now, cells_prev)) {
      call_extension("save", { cells: cells_now });
    }
  }, [viewupdate]);

  React.useEffect(() => {
    let active_highlight = viewupdate.state
      .selected_editor()
      ?.field(ActiveSelector, false);
    let prev_active_highlight = viewupdate.startState
      .selected_editor()
      ?.field(ActiveSelector, false);

    if (!isEqual(active_highlight, prev_active_highlight)) {
      let cool = viewupdate.state
        .selected_editor()
        ?.field(ActiveSelector, false);
      call_extension("highlight_selector", {
        selector: cool?.selector,
      });
    }
  }, [viewupdate]);

  let [position, set_position] = React.useState({ right: 16, bottom: -16 });
  let container_ref = React.useRef(null);
  let unsubscribe_drag_ref = React.useRef(() => {});

  return (
    <EditorBox
      ref={container_ref}
      style={{
        right: position.right,
        bottom: position.bottom,
        paddingBottom: Math.max(-position.bottom, 0),
      }}
      onClickCapture={(event) => {
        let target = /** @type {HTMLElement} */ (event.target);
        if (target.closest(".cm-editor") == null) {
          viewupdate.view.dispatch({
            effects: [BlurEditorInChiefEffect.of()],
          });
        }
      }}
    >
      <NotebookHeader
        onMouseDown={(event) => {
          if (event.defaultPrevented) return;

          let x = event.clientX;
          let y = event.clientY;

          unsubscribe_drag_ref.current();
          let mousemove_handler = (event) => {
            let right = x - event.clientX;
            let bottom = y - event.clientY;

            container_ref.current.style.transform = `translateX(${-right}px) translateY(${-bottom}px)`;
          };
          document.addEventListener("mousemove", mousemove_handler);
          let mouseup_handler = (event) => {
            unsubscribe_drag_ref.current();
            set_position(({ right, bottom }) => {
              return {
                right: right - (event.clientX - x),
                bottom: bottom - (event.clientY - y),
              };
            });
            container_ref.current.style.transform = "";
          };
          document.addEventListener("mouseup", mouseup_handler);
          unsubscribe_drag_ref.current = () => {
            document.removeEventListener("mousemove", mousemove_handler);
            document.removeEventListener("mouseup", mouseup_handler);
            unsubscribe_drag_ref.current = () => {};
          };
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <RxCrossCircled
            title="Close Paintbrush"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={(event) => {
              if (event.metaKey) {
                call_extension("reload");
              } else {
                call_extension("close");
              }
            }}
          />
        </div>
        <h1>Paintbrush</h1>
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          {viewupdate.state.field(CellOrderField).every((cell_id) => {
            let x = viewupdate.state.editor(cell_id);
            let meta = x.field(CellMetaField);
            return meta.folded;
          }) ? (
            <RxEyeOpen
              title="Open all"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                viewupdate.view.dispatch({
                  effects: viewupdate.state.field(CellOrderField).map((x) => {
                    return EditorDispatchEffect.of({
                      editor_id: x,
                      transaction: {
                        effects: MutateCellMetaEffect.of((x) => {
                          x.folded = false;
                        }),
                      },
                    });
                  }),
                });
              }}
            />
          ) : (
            <RxEyeClosed
              title="Close all"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                viewupdate.view.dispatch({
                  effects: viewupdate.state.field(CellOrderField).map((x) => {
                    return EditorDispatchEffect.of({
                      editor_id: x,
                      transaction: {
                        effects: MutateCellMetaEffect.of((x) => {
                          x.folded = true;
                        }),
                      },
                    });
                  }),
                });
              }}
            />
          )}
        </div>
      </NotebookHeader>

      <Editor viewupdate={viewupdate} />
    </EditorBox>
  );
};

let App = () => {
  let [state, set_state] = React.useState(/** @type {any} */ (null));
  React.useEffect(() => {
    call_extension("load").then((cells) => {
      set_state(notebook_to_editorinchief(cells ?? []));
    });
  }, []);

  if (state == null) {
    return null;
  }
  return <AppWhenLoaded state={state} set_state={set_state} />;
};

let EditorBox = styled.div`
  position: fixed;
  height: max(60vh, min(500px, 100vh));
  width: max(20vw, 400px);
  overflow: auto;

  background-color: rgb(24 24 24);
  outline: solid 1px #ffffff33;
  border-radius: 10px;

  padding-bottom: 16px;
  box-shadow: rgba(255, 255, 255, 0.04) 0px 0px 20px;
`;

export default App;
