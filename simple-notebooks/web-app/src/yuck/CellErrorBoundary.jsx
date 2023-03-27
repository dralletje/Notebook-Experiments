import React from "react";

export class CellErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 16,
            backgroundColor: "#2c0000",
            borderRadius: 10,
          }}
        >
          <h3>Codemirror Crashed</h3>
          <pre
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",

              whiteSpace: "pre-wrap",
              color: "#c90000",
            }}
          >
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
