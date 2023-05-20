import postcss from "postcss";
import nested from "postcss-nested";
import safe from "postcss-safe-parser";

let processor = postcss([nested]);
export let apply_postcss = (css: string) => {
  let result_css = processor.process(css, { parser: safe }).css;
  console.log(`result_css:`, result_css);
  return result_css;
};
