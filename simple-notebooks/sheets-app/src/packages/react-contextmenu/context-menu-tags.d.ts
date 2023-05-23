import { HTMLAttributes, MutableRefObject, RefAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "context-menu-item": HTMLAttributes<"div"> | RefAttributes<HTMLElement>;
      "context-menu-wrapper":
        | HTMLAttributes<"div">
        | RefAttributes<HTMLElement>;
      "context-menu-container":
        | HTMLAttributes<"div">
        | RefAttributes<HTMLElement>;
    }
  }
}
