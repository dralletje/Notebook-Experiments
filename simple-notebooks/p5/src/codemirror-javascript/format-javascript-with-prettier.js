import prettier from "prettier";
import prettier_typescript_parser from "prettier/parser-typescript";

/**
 * @typedef PrettierResult
 * @type {{ formatted: string, cursorOffset: number }}}
 */

/**
 * @param {PrettierResult} in
 * @returns {PrettierResult}
 */
let trim = ({ cursorOffset, formatted }) => {
  let trimmed = formatted.trim();
  return {
    formatted: trimmed,
    cursorOffset: Math.min(cursorOffset, trimmed.length),
  };
};

/**
 * @param {PrettierResult} in
 * @returns {PrettierResult}
 */
let dont_end_up_just_before_semicolon = ({ cursorOffset, formatted }) => {
  if (formatted[cursorOffset] === ";") {
    return {
      formatted,
      cursorOffset: cursorOffset + 1,
    };
  } else {
    return { formatted, cursorOffset };
  }
};

/**
 * @param {{
 *  prefix?: string,
 *  suffix?: string,
 *  code: string,
 *  cursor: number
 * }} props
 */
export let format_with_prettier = ({ code, cursor }) => {
  /** @type {PrettierResult} */
  let { formatted, cursorOffset } = prettier.formatWithCursor(code, {
    parser: "typescript",
    plugins: [prettier_typescript_parser],
    printWidth: 60,
    tabWidth: 2,
    cursorOffset: cursor,
    // Hate to do this but semis don't work nice here
    noSemi: true,
    // useTabs: true,
  });

  return trim({ formatted, cursorOffset: Math.max(cursorOffset, 0) });
};
