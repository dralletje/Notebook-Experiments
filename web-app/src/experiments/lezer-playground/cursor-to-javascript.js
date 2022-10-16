import { TreeCursor } from "@lezer/common";
import prettier from "prettier";
import prettier_typescript_parser from "prettier/parser-typescript";

/** @param {string} code */
let format_with_prettier = (code) => {
  return prettier.format(code, {
    parser: "typescript",
    plugins: [prettier_typescript_parser],
    printWidth: 40,
    tabWidth: 2,
    semi: false,
    useTabs: true,
  });
};

/** @param {TreeCursor} cursor */
let render_cursor = (cursor) => {
  let code = "";
  if (cursor.type.isError) {
    code += `new Error`;
  } else if (cursor.type.isAnonymous) {
    code += `"${cursor.name}"`;
  } else {
    if (/^[A-Z_$][a-zA-Z_$0-9]*$/.test(cursor.name)) {
      code += cursor.name;
    } else {
      code += `"${cursor.name}"`;
    }
  }

  if (cursor.firstChild()) {
    code += "(";
    try {
      do {
        code += render_cursor(cursor) + ", ";
      } while (cursor.nextSibling());
    } finally {
      cursor.parent();
    }
    code += `)`;
  }

  return code;
};

/** @param {TreeCursor} cursor */
export let cursor_to_javascript = (cursor) => {
  let code = render_cursor(cursor);
  try {
    return format_with_prettier(code);
  } catch (error) {
    console.error("Couldn't prettier-ify cursor-code:", error.message);
    return code;
  }
};
