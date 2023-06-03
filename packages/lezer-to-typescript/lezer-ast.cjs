let { compact } = require("lodash");
let { NodeProp } = require("@lezer/common");
const {
  util: { isNextLineEmpty, isPreviousLineEmpty, skipWhitespace },
} = require("prettier");

/**
 * @typedef PrettierComment
 * @type {{
 *   printed?: boolean,
 *   placement?: "ownLine" | "endOfLine",
 *   trailing?: boolean,
 *   leading?: boolean,
 *   value: string,
 *   from: number,
 *   to: number,
 * }}
 */

/**
 * @template {string} [TokenNames=string]
 * @typedef LezerNode
 * @type {{
 *  name: TokenNames,
 *  children: Array<LezerNode<TokenNames>>,
 *  source: string,
 * }}
 */

function* node_children(
  /** @type {import("@lezer/common").SyntaxNode} */ node
) {
  if (node.firstChild) {
    /** @type {import("@lezer/common").SyntaxNode | null} */
    let current_node = node.firstChild;
    do {
      yield current_node;
      current_node = current_node.nextSibling;
    } while (current_node != null);
  }
}

/**
 * @returns {LezerNode}
 */
let to_simple_object = (
  /** @type {import("@lezer/common").SyntaxNode} */ node,
  /** @type {string} */ source_text
) => {
  let children = compact(
    Array.from(node_children(node)).map((x) => to_simple_object(x, source_text))
  );

  return {
    name: node.name,
    source: source_text.slice(node.from, node.to),
    children: children,
  };
};
module.exports.to_simple_object = to_simple_object;
