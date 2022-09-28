import prettier from "prettier";
import prettier_javascript_parser from "prettier/parser-babel";

/**
 * @param {{
 *  prefix?: string,
 *  suffix?: string,
 *  code: string,
 *  cursor: number
 * }} props
 */
export let format_with_prettier = ({ code, cursor }) => {
  return prettier.formatWithCursor(code, {
    parser: "babel",
    plugins: [prettier_javascript_parser],
    printWidth: 80,
    semi: false,
    cursorOffset: cursor,
    useTabs: true,
  });
};
