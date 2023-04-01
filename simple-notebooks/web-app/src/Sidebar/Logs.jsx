import { EditorState } from "@codemirror/state";
import { useViewUpdate } from "codemirror-x-react/viewupdate.js";
import React from "react";
import styled from "styled-components";
import { Cell } from "../Cell.jsx";
import { EditorHasSelectionField } from "../packages/codemirror-editor-in-chief/editor-has-selection-extension";
import { CellMetaField } from "../packages/codemirror-notebook/cell";
import { Flipper, Flipped, spring } from "react-flip-toolkit";
import "./Logs.css";

import shadow from "react-shadow/styled-components";

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

let ShadowLogStyle = styled.div`
  .cell {
    border-radius: 5px;
    overflow: hidden;
    border: solid 1px #ffffff36;

    .inspector-container {
      background-color: #70006f26;
    }
    .cell-editor {
      background-color: #70006f45;
    }
    .cell-editor:not(:focus-within) {
      max-height: 85px;
    }

    .cell-editor .cm-content {
      margin: 8px;
    }
  }
`;

/**
 * @param {{
 *  cell_id: any,
 *  cylinder: import("../packages/codemirror-notebook/cell.js").CylinderShadow,
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
            requested_run_time: -Infinity,
            type: "code",
            folded: false,
          };
        }),
      ],
    });
  }, []);

  let [editor_state, set_editor_state] = React.useState(initial_editor_state);

  let viewupdate = useViewUpdate(editor_state, set_editor_state);

  return (
    <shadow.div>
      <ShadowLogStyle>
        <Cell
          cell_id={cell_id}
          cylinder={{
            ...cylinder,
            // @ts-ignore
            result: {
              ...cylinder.result,
              name: undefined,
            },
          }}
          viewupdate={viewupdate}
          is_selected={false}
          did_just_get_created={false}
        />
      </ShadowLogStyle>
    </shadow.div>
  );
};

/**
 * @param {{
 *  logs: import("../use/use-local-environment.js").EngineLog[],
 *  notebook: import("../packages/codemirror-notebook/cell.js").Notebook,
 *  engine: import("../packages/codemirror-notebook/cell.js").EngineShadow,
 * }} props
 */
export let Logs = ({ logs, notebook, engine }) => {
  let key = logs.map((x) => `${x.id}-${x.cylinder.running}`).join(",");
  return (
    <Flipper spring={"veryGentle"} flipKey={key}>
      <div className="log-list">
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
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.5)",
                        color: "white",
                        borderRadius: "50%",
                        width: "2em",
                        height: "2em",
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {log.repeat}
                    </div>
                  )}
                </div>
              </Flipped>
            </Interact>
          ))}
      </div>
    </Flipper>
  );
};
