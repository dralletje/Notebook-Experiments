import { cursor_to_javascript } from "./cursor-to-javascript.js";

export default function ProvideCursorToJavascript({ children }) {
  return children(cursor_to_javascript);
}
