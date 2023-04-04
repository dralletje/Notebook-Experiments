import { EditorState } from "@codemirror/state";
import { useViewUpdate } from "codemirror-x-react/viewupdate.js";
import React from "react";
import styled from "styled-components";
import { Cell } from "../../Notebook/Cell.jsx";
import { EditorHasSelectionField } from "../../packages/codemirror-editor-in-chief/editor-has-selection-extension";
import { CellMetaField } from "../../packages/codemirror-notebook/cell";
import { Flipper, Flipped, spring } from "react-flip-toolkit";

import shadow from "react-shadow/styled-components";
import { AdoptStylesheet, CSSish } from "../../yuck/adoptedStyleSheets";

// @ts-ignore
import logs_css from "./Logs.css?inline";
// @ts-ignore
import shadow_log_css from "./shadow-log.css?inline";

let logs_sheet = new CSSish(logs_css);
let shadow_log_sheet = new CSSish(shadow_log_css);

let NOOP = () => {};

let Interact = ({ onHover, children }) => {
  let hover_dispose = React.useRef(NOOP);

  return (
    <div
      style={{ display: "contents" }}
      onMouseEnter={() => {
        hover_dispose.current();
        hover_dispose.current = onHover() ?? NOOP;
      }}
      onMouseLeave={() => {
        hover_dispose.current();
      }}
    >
      {children}
    </div>
  );
};

/**
 * @param {{
 *  cell_id: any,
 *  cylinder: import("../../packages/codemirror-notebook/cell.js").CylinderShadow,
 *  code: string,
 * }} props
 */
let InlineCell = ({ cell_id, cylinder, code }) => {
  let initial_editor_state = React.useMemo(() => {
    return EditorState.create({
      doc: code,
      extensions: [
        EditorState.readOnly.of(true),
        EditorHasSelectionField.init(() => false),
        CellMetaField.init(() => {
          return {
            code: code,
            requested_run_time: 0,
            type: "code",
            folded: false,
          };
        }),
      ],
    });
  }, []);

  let [editor_state, set_editor_state] = React.useState(initial_editor_state);

  let viewupdate = useViewUpdate(
    editor_state,
    /** @type {any} */ (set_editor_state)
  );

  return (
    <shadow.div>
      <AdoptStylesheet stylesheet={shadow_log_sheet} />
      <Cell
        cell_id={cell_id}
        cylinder={{
          ...cylinder,
          // @ts-ignore
          result: {
            ...cylinder.result,
            // @ts-ignore
            name: undefined,
          },
        }}
        viewupdate={viewupdate}
        is_selected={false}
        did_just_get_created={false}
      />
    </shadow.div>
  );
};

/**
 * @param {{
 *  logs: import("../../environment/Environment.js").EngineLog[],
 *  notebook: import("../../packages/codemirror-notebook/cell.js").Notebook,
 *  engine: import("../../packages/codemirror-notebook/cell.js").EngineShadow,
 * }} props
 */
export let Logs = ({ logs, notebook, engine }) => {
  let key = logs.map((x) => `${x.id}-${x.cylinder.running}`).join(",");
  return (
    <div className="log-list">
      <AdoptStylesheet stylesheet={logs_sheet} />

      <Flipper spring={"veryGentle"} flipKey={key}>
        {logs
          .slice()
          .reverse()
          .map((log) => (
            <Interact
              key={log.id}
              onHover={() => {
                let el = document
                  .getElementById(log.cell_id)
                  ?.querySelector(".cell");
                if (el) {
                  el.classList.add("being-watched");
                  // @ts-ignore
                  return () => el.classList.remove("being-watched");
                }
              }}
            >
              <Flipped
                flipId={log.id}
                // stagger
                onAppear={(element, index, data) => {
                  element.style.opacity = "1";
                  let bounding_rect = element.getBoundingClientRect();
                  let distance = bounding_rect.top + bounding_rect.height;
                  element.style.transform = `translateY(-${distance}px)`;
                  spring({
                    config: "veryGentle",
                    values: {
                      translateY: [-distance, 0],
                    },
                    // @ts-ignore
                    onUpdate: ({ translateY }) => {
                      element.style.transform = `translateY(${translateY}px)`;
                    },
                    delay: index * 100,
                  });
                }}
              >
                <div
                  className="log mx-3 relative"
                  data-cell-id={log.cell_id}
                  onDoubleClick={() => {
                    let el = document.getElementById(log.cell_id);
                    if (el) {
                      el.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                      });
                    }
                  }}
                >
                  <InlineCell
                    cell_id={log.cell_id}
                    cylinder={log.cylinder}
                    code={log.code}
                  />
                  {/* <Timesince time={cylinder.result.time} /> */}

                  {log.repeat > 1 && (
                    <div className="log-repeat">{log.repeat}</div>
                  )}
                </div>
              </Flipped>
            </Interact>
          ))}
      </Flipper>
    </div>
  );
};
