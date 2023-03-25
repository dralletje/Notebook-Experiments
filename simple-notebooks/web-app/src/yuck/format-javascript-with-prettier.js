import prettier from "prettier";
import prettier_javascript_parser from "prettier/parser-babel";
import prettier_typescript_parser from "prettier/parser-typescript";

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
    parser: "typescript",
    plugins: [prettier_typescript_parser],
    printWidth: 60,
    tabWidth: 2,
    cursorOffset: cursor,
    // useTabs: true,
  });
};
