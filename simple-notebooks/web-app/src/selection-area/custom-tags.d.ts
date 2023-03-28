import { HTMLAttributes, MutableRefObject, RefAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "selection-area-wrapper":
        | HTMLAttributes<"div">
        | RefAttributes<HTMLElement>;
      "dral-selection-area": HTMLAttributes<"div"> | RefAttributes<HTMLElement>;
      "dral-prevent-hover": HTMLAttributes<"div"> | RefAttributes<HTMLElement>;
      "dral-cell": HTMLAttributes<"div"> | RefAttributes<HTMLElement>;
    }
  }
}
