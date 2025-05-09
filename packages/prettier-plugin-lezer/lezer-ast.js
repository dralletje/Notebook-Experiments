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
 *  from: number,
 *  group: readonly string[] | undefined,
 *  to: number,
 *  comments?: Array<PrettierComment>,
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
 * @template {string} [TokenNames=string]
 * @returns {LezerNode<TokenNames>}
 */
let to_simple_object = (
  /** @type {import("@lezer/common").SyntaxNode} */ node,
  /** @type {string} */ source_text,
  /** @type {(node: PrettierComment) => void} */ report_comment
) => {
  let comments = [];

  let children = compact(
    Array.from(node_children(node)).map((x) => {
      if (x.name === "LineComment" || x.name === "BlockComment") {
        report_comment({
          value: source_text.slice(x.from, x.to),
          from: x.from,
          to: x.to,
        });
        return null;
      } else {
        return /** @type {LezerNode<TokenNames>} */ (
          /** @type {any} */ (to_simple_object(x, source_text, report_comment))
        );
      }
    })
  );
  return {
    // root_source: source_text,
    name: /** @type {TokenNames} */ (node.name),
    // node: node,
    comments: comments,
    from: node.from,
    to: node.to,
    group: node.type.prop(NodeProp.group),
    children: children,
    source: source_text.slice(node.from, node.to),
  };
};
module.exports.to_simple_object = to_simple_object;
