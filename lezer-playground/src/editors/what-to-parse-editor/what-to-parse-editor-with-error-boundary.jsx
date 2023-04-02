import React from "react";
import styled from "styled-components";
import { Failure } from "../../use/OperationMonadBullshit.js";
import { WhatToParseEditor } from "./what-to-parse-editor.jsx";

let ErrorBox = styled.div`
  color: rgb(181 181 181);
  background-color: #420000;
  padding: 8px;
  padding-top: 0px;
  max-height: 50%;
  overflow: auto;
  font-size: 16px;

  h1 {
    padding-top: 8px;
    padding-bottom: 4px;
    font-weight: bold;
    font-size: 12px;
    background-color: #420000;

    position: sticky;
    top: 0px;
  }

  pre {
    white-space: pre-wrap;
  }
`;

/**
 * @extends {React.Component<Parameters<WhatToParseEditor>[0] & { errors: Array<{ title: string, error: Error }> }, { component_error: Error | null }>}
 */
export class WhatToParseEditorWithErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { component_error: null };
    this.last_js_stuff = props.js_stuff;
  }

  static getDerivedStateFromError(error) {
    return { component_error: error };
  }

  render() {
    let { component_error } = this.state;
    let { js_stuff, errors, ...props } = this.props;

    if (this.last_js_stuff != this.props.js_stuff) {
      this.last_js_stuff = this.props.js_stuff;
      if (component_error != null) {
        // React will whine about this, but it's fine.
        this.setState({ component_error: null });
      }
    }

    let js_stuff_safe =
      component_error != null || this.props.js_stuff instanceof Failure
        ? Failure.of(new Error("Javascript stuff is not okay"))
        : js_stuff;

    let errors_with_component_error = [
      ...errors,
      ...(component_error != null
        ? [{ title: "CodeMirror error", error: component_error }]
        : []),
    ];

    return (
      <div
        style={{
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <WhatToParseEditor
            key={js_stuff_safe != null ? "error" : "fine"}
            {...props}
            js_stuff={js_stuff_safe}
          />
        </div>

        {errors_with_component_error.length > 0 && (
          <ErrorBox>
            {errors_with_component_error.map((error) => (
              <React.Fragment key={error.title}>
                <h1>{error.title}</h1>
                {/* @ts-ignore */}
                <pre>{error.error.message}</pre>
              </React.Fragment>
            ))}
          </ErrorBox>
        )}
      </div>
    );
  }
}
