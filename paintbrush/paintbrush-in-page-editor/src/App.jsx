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
  EditorExtension,
  EditorInChiefKeymap,
} from "./codemirror-editor-in-chief/editor-in-chief";
import { isEqual } from "lodash";
import { decorate_colors } from "./Codemirror/ColorHighlight";
import dedent from "string-dedent";
import {
  css_variable_completions,
  css_variables_facet,
} from "./Codemirror/css-variable-completions";

import { CellOrderField } from "./codemirror-notebook/cell-order";
import { cell_movement_extension } from "./codemirror-notebook/cell-movement";
import { cell_keymap } from "./codemirror-notebook/add-move-and-run-cells";
import { create_empty_cell_facet } from "./codemirror-notebook/config";

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
  border-radius: 10px 10px 0 0;
`;

let CellHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  /* padding-top: 8px; */
  position: sticky;
  top: 0;

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
 *  load: {
 *    "input": void,
 *    "output": Cell[],
 *  },
 *  ready: { "input": void },
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

let code_tab = keymap.of([
  {
    key: "Tab",
    run: indentMore,
    shift: indentLess,
  },
]);

let send_selector_to_highlight_extension = EditorView.updateListener.of(
  (update) => {
    if (
      update.state.field(ActiveSelector, false) !==
      update.startState.field(ActiveSelector, false)
    ) {
      let cool = update.state.field(ActiveSelector, false);
      call_extension("highlight_selector", {
        selector: cool?.selector,
      });
    }
  }
);

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
 *   viewupdate: GenericViewUpdate<EditorInChief<EditorState>>,
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

              <div style={{ display: collapsed ? "none" : "block" }}>
                <CodemirrorFromViewUpdate viewupdate={cell_update}>
                  <Extension key="basic" extension={basic_css_extensions} />
                  <Extension extension={placeholder("Style away!")} deps={[]} />
                  <Extension extension={decorate_colors} />
                  <Extension extension={code_tab} />
                  <Extension extension={pkgBubblePlugin()} deps={[]} />
                  <Extension extension={send_selector_to_highlight_extension} />
                  <Extension extension={css_variables_facet_value} />
                  <Extension extension={css_variable_completions} />
                </CodemirrorFromViewUpdate>
              </div>
            </Cell>
          </React.Fragment>
        );
      })}
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
      call_extension("css", { code: code_now });
    }
  }, [viewupdate]);

  React.useEffect(() => {
    let cells_now = editorinchief_to_serialized(viewupdate.state);
    let cells_prev = editorinchief_to_serialized(viewupdate.startState);

    if (!isEqual(cells_now, cells_prev)) {
      call_extension("save", { cells: cells_now });
    }
  }, [viewupdate]);

  return (
    <EditorBox>
      <NotebookHeader>
        <h1>Paintbrush</h1>

        <button
          onClick={() => {
            call_extension("toggle-horizontal-position");
          }}
        >
          s
        </button>
      </NotebookHeader>

      <Editor viewupdate={viewupdate} />
    </EditorBox>
  );
};

let App = () => {
  let [state, set_state] = React.useState(/** @type {any} */ (null));
  React.useEffect(() => {
    call_extension("load").then((cells) => {
      set_state(
        notebook_to_editorinchief(
          (cells ?? []).length === 0 ? [empty_cell()] : cells
        )
      );
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
  overflow: auto;

  background-color: rgb(24 24 24);
  outline: solid 1px #ffffff33;
  border-radius: 10px 10px 0 0;
  /* transform: translateX(calc(100% + 16px)); */
  transition: transform 0.5s;
`;

export default App;
