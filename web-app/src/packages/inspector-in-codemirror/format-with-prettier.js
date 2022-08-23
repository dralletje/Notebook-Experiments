import prettier from "prettier";
import prettier_javascript_parser from "prettier/parser-babel";

/**
 * @param {{
 *  prefix?: string,
 *  suffix?: string,
 *  code: string,
 * }} props
 */
export let format_with_prettier = ({ code }) => {
  try {
    return prettier
      .format(code, {
        parser: "babel",
        plugins: [prettier_javascript_parser],
        printWidth: 40,
        semi: false,
      })
      .trim();
  } catch (error) {
    console.error("Couldn't format your code:", error.message);
    return code;
  }
};
