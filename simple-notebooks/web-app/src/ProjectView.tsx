import React from "react";

import styled from "styled-components";
import { isEqual } from "lodash";
import {
  GenericViewUpdate,
  useViewUpdate,
} from "codemirror-x-react/viewupdate";

import {
  SelectCellsEffect,
  SelectedCellsField,
} from "./packages/codemirror-notebook/cell-selection";

import {
  BlurEditorInChiefEffect,
  EditorId,
  EditorIdFacet,
  EditorInChief,
  extract_nested_viewupdate,
} from "./packages/codemirror-editor-in-chief/editor-in-chief";
import {
  CellMetaField,
  CellTypeFacet,
  EngineShadow,
} from "./packages/codemirror-notebook/cell";
import { CellOrderField } from "./packages/codemirror-notebook/cell-order.js";

import { useCodemirrorKeyhandler } from "./use/use-codemirror-keyhandler.js";
import { InlineCell, Logs } from "./Sidebar/Logs/Logs.jsx";
import { useEngine } from "./environment/use-engine.js";
import { Environment } from "./environment/Environment";
import { Excell } from "./ExcellView";
import { useUrl } from "./packages/use-url/use-url";
import { NotebookView } from "./Notebook/NotebookView";
import shadow from "react-shadow/styled-components";
import { AdoptStylesheet, CSSish } from "./yuck/adoptedStyleSheets";

// @ts-ignore
import shadow_notebook_css from "./yuck/shadow-notebook.css?inline";
import { EditorState } from "@codemirror/state";
import { SelectedCellField } from "./packages/codemirror-sheet/sheet-selected-cell";

import { parse } from "excel-formula-parser";
import { SheetPosition } from "./packages/codemirror-sheet/sheet-position";
import { Cell } from "./Notebook/Cell";

let tree_to_js = (tree: ReturnType<typeof parse>) => {
  if (tree.type === "function") {
    return `${tree.name}(${tree.arguments.map(tree_to_js).join(", ")})`;
  }
  if (tree.type === "cell") {
    return `${tree.key}`.replaceAll(/\$/g, "");
  }
  if (tree.type === "text") {
    return JSON.stringify(tree.value);
  }
  if (tree.type === "number") {
    return `${tree.value}`;
  }
  if (tree.type === "binary-expression") {
    // prettier-ignore
    return `${tree_to_js(tree.left)} ${tree.operator} ${tree_to_js(tree.right)}`;
  }
  console.log(`tree:`, tree);
  throw new Error(`Unknown tree type: ${tree.type}`);
};
let convert_formula_to_js = (formula: string) => {
  formula = formula.trim();
  if (formula.startsWith("=")) {
    try {
      const tree = parse(formula.slice(1));
      return tree_to_js(tree);
    } catch {
      return `throw new Error("Invalid formula: ${formula}")`;
    }
  } else {
    if (formula === "") {
      return "undefined";
    }
    let number = Number(formula);
    if (!Number.isNaN(number)) {
      return `${number}`;
    }
    return `\`${formula.replaceAll(/`/g, "\\`")}\``;
  }
};

let shadow_notebook = new CSSish(shadow_notebook_css);

let Sheet = () => {};

// type Executable = {
//   id: string;
//   scope: "global" | "cell";
//   code: string;
// }
// type SimpleExecutables = {
//   order: string[];
// }

export function ProjectView({
  filename,
  state: _state,
  onChange,
  environment,
}: {
  filename: string;
  state: EditorInChief<any>;
  onChange: (state: any) => void;
  environment: Environment;
}) {
  let viewupdate = useViewUpdate(_state, onChange);

  let sheet_viewupdate = extract_nested_viewupdate(
    viewupdate,
    "sheet" as EditorId
  ) as any as GenericViewUpdate<EditorInChief<EditorState>>;
  let notebook_viewupdate = extract_nested_viewupdate(
    viewupdate,
    "notebook" as EditorId
  ) as any as GenericViewUpdate<EditorInChief<EditorState>>;

  let notebook_editorstates = notebook_viewupdate.state.editors;
  let notebook_cell_order = notebook_viewupdate.state.field(CellOrderField);

  let sheet_editorstates = sheet_viewupdate.state.editors;
  let sheet_cell_order = sheet_editorstates.keys().toArray();

  let notebook = React.useMemo(() => {
    return /** @type {import("./packages/codemirror-notebook/cell").Notebook} */ {
      cell_order: [...notebook_cell_order, ...sheet_cell_order],
      cells: Object.fromEntries([
        ...notebook_cell_order.map((cell_id) => {
          let cell_state = notebook_editorstates.get(cell_id);
          let type = cell_state.facet(CellTypeFacet);
          return [
            cell_id,
            {
              id: cell_state.facet(EditorIdFacet),
              type: type,
              code: cell_state.field(CellMetaField).code,
              requested_run_time:
                cell_state.field(CellMetaField).requested_run_time,
            },
          ];
        }),
        ...sheet_cell_order.map((cell_id) => {
          let cell_state = sheet_editorstates.get(cell_id);
          let { code, requested_run_time } = cell_state.field(CellMetaField);
          return [
            cell_id,
            {
              id: cell_state.facet(EditorIdFacet),
              type: "code",
              code: convert_formula_to_js(code),
              requested_run_time: requested_run_time,
            },
          ];
        }),
      ]),
    };
  }, [notebook_editorstates, notebook_cell_order]);

  let notebook_with_filename = React.useMemo(() => {
    return { filename: filename, notebook: notebook };
  }, [notebook, filename]);

  let [engine, logs] = useEngine(notebook_with_filename, environment);

  let [url, set_url, set_url_no_backsies] = useUrl();
  let tab = url.searchParams.get("tab") ?? "notebook";
  let set_tab = (tab) => {
    let url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    set_url_no_backsies(url);
  };

  let selected_cell = sheet_viewupdate.state.field(SelectedCellField);
  React.useLayoutEffect(() => {
    if (selected_cell != null) {
      let url = new URL(window.location.href);
      url.hash = `#${selected_cell.id}`;
      set_url_no_backsies(url);
    } else {
      let url = new URL(window.location.href);
      url.hash = "";
      set_url_no_backsies(url);
    }
  }, [selected_cell]);

  return (
    <div style={{ display: "flex", flex: 1, zIndex: 0 }}>
      <main style={{ flex: 1 }}>
        <Excell viewupdate={sheet_viewupdate} engine={engine} />
      </main>

      <Sidebar className={`tab-${tab}`}>
        <nav>
          <a
            href={"?tab=details" + window.location.hash}
            aria-current={tab === "details" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              set_tab("details");
            }}
          >
            Details
          </a>

          <a
            href={"?tab=notebook" + window.location.hash}
            aria-current={tab === "notebook" ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              set_tab("notebook");
            }}
          >
            Notebook
          </a>
          <a
            href={"?tab=logs" + window.location.hash}
            aria-current={tab === "logs" ? "page" : undefined}
            className={tab === "logs" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              set_tab("logs");
            }}
          >
            Logs
          </a>
        </nav>

        <section>
          {tab === "logs" && (
            <Logs logs={logs} notebook={notebook} engine={engine} />
          )}
          {tab === "notebook" && (
            <shadow.div>
              <AdoptStylesheet stylesheet={shadow_notebook} />
              <NotebookView engine={engine} viewupdate={notebook_viewupdate} />
            </shadow.div>
          )}
          {tab === "details" && (
            <SidebarDetails
              selected_cell={selected_cell}
              viewupdate={viewupdate}
              engine={engine}
            />
          )}
        </section>
      </Sidebar>
    </div>
  );
}

let SidebarDetails = ({
  selected_cell,
  viewupdate,
  engine,
}: {
  selected_cell: SheetPosition;
  viewupdate: GenericViewUpdate<any>;
  engine: EngineShadow;
}) => {
  let cell_viewupdate = extract_nested_viewupdate(
    extract_nested_viewupdate(viewupdate, "sheet"),
    selected_cell.id
  );
  let code = cell_viewupdate.state?.doc?.toString() ?? "";

  return (
    <div>
      <InlineCell
        key={selected_cell.id}
        cell_id={selected_cell.id}
        cylinder={engine.cylinders[selected_cell.id]}
        code={code}
      />
    </div>
  );
};

let Sidebar = styled.div`
  position: sticky;
  top: var(--header-height);
  right: 0px;

  z-index: 10;

  width: var(--sidebar-width);
  height: calc(100vh - var(--header-height));

  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow-y: auto;
  background-color: black;

  /* Why are these separate?!
     Because I think I might want to disable/enable these on a whim */
  border-top: 5px solid white;
  border-left: 5px solid white;
  border-right: 5px solid white;
  border-bottom: 5px solid white;

  border-color: rgba(0, 0, 0, 0.5);

  &.tab-details {
    background-color: rgb(68 22 22);
  }
  &.tab-notebook {
    background-color: #01412d;
  }
  &.tab-logs {
    background-color: rgb(19, 14, 48);
  }

  nav {
    display: flex;
    flex-direction: row;

    position: sticky;
    top: 0;
    z-index: 1;
    background-color: inherit;
    padding-bottom: 5px;

    a {
      flex: 1;
      text-align: center;
      padding: 2px 10px;
      font-weight: bold;
      user-select: none;

      background-color: rgba(0, 0, 0, 0.5);
      color: #ffffff66;

      &[aria-current="page"] {
        background-color: rgba(0, 0, 0, 0);
        color: #ffffffd4;
        cursor: initial;
      }

      &:not([aria-current="page"]):hover {
        background-color: rgba(0, 0, 0, 0.4);
      }
    }
  }

  section {
    display: flex;
    flex-direction: column;
    flex: 1;
    z-index: 0;
  }
`;
