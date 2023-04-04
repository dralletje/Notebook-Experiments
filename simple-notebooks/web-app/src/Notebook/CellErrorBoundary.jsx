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
        <div className="flex flex-col p-4 bg-red-900 rounded-md text-red-100">
          <h3 className="font-mono">Codemirror Crashed</h3>
          <pre
            className="font-mono whitespace-pre-wrap text-red-500"
            // style={{
            //   display: "flex",
            //   flexDirection: "column",
            //   alignItems: "center",
            //   justifyContent: "center",
            //   height: "100%",

            //   whiteSpace: "pre-wrap",
            //   color: "#c90000",
            // }}
          >
            {this.state.error?.message}
          </pre>
          <button
            className="
              font-mono 
              bg-red-700 hover:bg-red-500 transition-colors 
              cursor-pointer 
              self-start 
              px-4
              rounded-sm
              mt-2
            "
            onClick={() => {
              this.setState({ error: null });
            }}
          >
            retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
