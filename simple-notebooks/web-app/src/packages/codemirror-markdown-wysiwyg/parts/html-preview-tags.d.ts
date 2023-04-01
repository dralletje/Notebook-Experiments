import { HTMLAttributes, MutableRefObject, RefAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "markdown-html-preview":
        | HTMLAttributes<"div">
        | RefAttributes<HTMLElement>;
      "markdown-html-render":
        | HTMLAttributes<"div">
        | RefAttributes<HTMLElement>;
      "markdown-html-toggle":
        | HTMLAttributes<"div">
        | RefAttributes<HTMLElement>;
    }
  }
}
