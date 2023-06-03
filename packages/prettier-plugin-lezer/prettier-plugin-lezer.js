const {
  AstPath,
  util: { isNextLineEmpty, isPreviousLineEmpty, skipWhitespace },
} = require("prettier");
let { parser } = require("@lezer/lezer");
let {
  builders: {
    hardline,
    indent,
    group,
    line,
    join,
    softline,
    dedent,
    ifBreak,
    breakParent,
    fill,
  },
} = require("prettier/doc");
const { to_simple_object } = require("./lezer-ast.js");
const { dont_break } = require("./utils.js");

module.exports.languages = [
  {
    name: "lezer",
    parsers: ["lezer"],
    extensions: [".grammar"],
  },
];

/**
 * @typedef TokenNames
 * @type {"⚠" | "LineComment" | "BlockComment" | "Grammar" | "RuleDeclaration" | "RuleName" | "]" | "[" | "Props" | "Prop" | "AtName" | "Name" | "=" | "Literal" | "." | "}" | "{" | "PropEsc" | "ParamList" | "Body" | "CharSet" | "AnyChar" | "InvertedCharSet" | "ScopedName" | "Call" | "ArgList" | "CharClass" | "?" | "Optional" | "*" | "Repeat" | "+" | "Repeat1" | "InlineRule" | ")" | "(" | "ParenExpression" | "Specialization" | "@specialize" | "@extend" | "Sequence" | "PrecedenceMarker" | "!" | "PrecedenceName" | "AmbiguityMarker" | "~" | "Choice" | "|" | "RuleDeclaration" | "@top" | "PrecedenceDeclaration" | "@precedence" | "PrecedenceBody" | "Precedence" | "@left" | "@right" | "@cut" | "TokensDeclaration" | "@tokens" | "TokensBody" | "TokenPrecedenceDeclaration" | "PrecedenceBody" | "TokenConflictDeclaration" | "@conflict" | "ConflictBody" | "LiteralTokenDeclaration" | "LocalTokensDeclaration" | "@local" | "tokens" | "TokensBody" | "ElseToken" | "@else" | "ExternalTokensDeclaration" | "@external" | "from" | "TokensBody" | "Token" | "ExternalPropDeclaration" | "prop" | "as" | "ExternalPropSourceDeclaration" | "propSource" | "ExternalSpecializeDeclaration" | "extend" | "specialize" | "ContextDeclaration" | "@context" | "DialectsDeclaration" | "@dialects" | "DialectBody" | "TopSkipDeclaration" | "@skip" | "SkipScope" | "SkipBody" | "DetectDelimDeclaration" | "@detectDelim"}
 */

if (false) {
  console.log(
    `type TokenNames =`,
    parser.nodeSet.types
      .filter((x) => x.name !== "")
      .map((x) => `"${x.name}"`)
      .join(" | ")
  );
}

/**
 * @typedef LezerNode
 * @type {import("./lezer-ast.js").LezerNode}
 */

module.exports.parsers = {
  lezer: {
    parse(text, parsers, options) {
      let ast = parser.parse(text);

      let comments = [];
      let full_object = to_simple_object(ast.topNode, text, (comment_node) => {
        comments.push(comment_node);
      });
      full_object.comments = comments;
      return full_object;
    },
    // The name of the AST that
    astFormat: "lezer",
    locStart: (/** @type {LezerNode} */ node) => {
      // console.log(`node from:`, node.from);
      return node.from;
    },
    locEnd: (/** @type {LezerNode} */ node) => {
      // console.log(`node to:`, node.to);
      return node.to;
    },
    // hasPragma,
    // preprocess,
  },
};

let has_newline_after = (
  /** @type {LezerNode} */ node,
  /** @type {Options} */ options
) => {
  let begin_next = skipWhitespace(options.originalText, node.to);
  if (!begin_next) return false;
  return options.originalText.slice(node.from, begin_next).includes("\n");
};

let is_next_line_empty = (
  /** @type {LezerNode} */ node,
  /** @type {Options} */ options
) => {
  return isNextLineEmpty(options.originalText, node, (node) => node.to);
};

let is_previous_line_empty = (
  /** @type {LezerNode} */ node,
  /** @type {Options} */ options
) => {
  return isPreviousLineEmpty(options.originalText, node, (node) => node.from);
};

let print_choice = (
  /** @type {LezerNode[]} */ nodes,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  return group(
    nodes.map((node, index) => {
      if (node.name === "|") return [" ", "|"];

      if (index === 0) {
        return print(node);
      }

      return [
        is_previous_line_empty(node, options) ? line : [],
        line,
        print(node),
      ];
    })
  );
};

let print_list = (
  /** @type {LezerNode[]} */ nodes,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  let is_empty = !nodes.find((x) => x.name !== "{" && x.name !== "}");
  return nodes.map((node, index) => {
    if (node.name === "{") return ["{"];
    if (node.name === "}") return dedent([is_empty ? softline : line, "}"]);
    if (node.name === "|") throw new Error("Unexpected |");

    if (index === 0) {
      return print(node);
    }

    return [
      is_previous_line_empty(node, options) ? line : [],
      line,
      print(node),
    ];
  });
};

let print_tokens_body = (
  /** @type {LezerNode[]} */ nodes,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  /** @type {import("prettier").Doc[]} */
  let parts = [];

  /** @type {LezerNode?} */
  let current_literal_start = null;
  /** @type {import("prettier").Doc[]} */
  let current_literal_parts = [];

  let is_empty = !nodes.find((x) => x.name !== "{" && x.name !== "}");
  for (let node of nodes) {
    if (node.name === "LiteralTokenDeclaration") {
      current_literal_parts.push(print(node));
      current_literal_start = node;

      if (is_previous_line_empty(node, options)) {
        parts.push(hardline);
      }
      if (!is_next_line_empty(node, options)) {
        continue;
      }
    }
    if (current_literal_parts.length > 0 && current_literal_start) {
      parts.push([hardline, join(" ", current_literal_parts)]);

      current_literal_start = null;
      current_literal_parts = [];
    }
    if (node.name === "LiteralTokenDeclaration") {
      continue;
    }

    if (node.name === "{") {
      parts.push("{");
      continue;
    }
    if (node.name === "}") {
      parts.push(dedent([is_empty ? softline : line, "}"]));
      continue;
    }

    parts.push([
      is_previous_line_empty(node, options) ? hardline : [],
      hardline,
      print(node),
    ]);
  }

  return indent(parts);
};

let print_props = (
  /** @type {LezerNode[]} */ nodes,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  return indent(
    group(
      nodes.map((node, index) => {
        if (node.name === "[") return "[";
        if (node.name === "]") return dedent([softline, "]"]);

        return [
          is_previous_line_empty(node, options) ? breakParent : [],
          softline,
          print(node),
          node.name === "Prop" && index < nodes.length - 2 ? "," : [],
        ];
      })
    )
  );
};

let print_hard_list = (
  /** @type {LezerNode[]} */ nodes,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  return nodes.map((node, index) => {
    if (index === 0) {
      return group(print(node));
    }

    return [
      is_previous_line_empty(node, options) ? hardline : [],
      hardline,
      group(print(node)),
    ];
  });
};

let unwrap_parens = (/** @type {LezerNode} */ node) => {
  if (node.name === "RuleName") {
    return node;
  }
  if (
    node.name === "Repeat1" ||
    node.name === "Repeat" ||
    node.name === "Optional" ||
    node.name === "ParenExpression"
  ) {
    return node.children[0];
  }
};

/**
 * @typedef LezerPath
 * @type {LezerNode}
 */

let print_body = (
  /** @type {LezerPath} */ node,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  let is_empty = !node.children.find((x) => x.name !== "{" && x.name !== "}");
  return node.children.map((node, index) => {
    if (node.name === "{") return ["{", is_empty ? softline : line];
    if (node.name === "}") return dedent([is_empty ? softline : line, "}"]);
    return group(print(node));
  });
};

let fake_print_comments = (/** @type {LezerPath} */ node) => {
  for (let child of node.children) {
    for (let comment of child.comments ?? []) {
      comment.printed = true;
    }
    fake_print_comments(child);
  }
};

/** @returns {import("prettier").Doc} */
let print = (
  /** @type {LezerPath} */ node,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  for (let comment of node.comments ?? []) {
    if (comment.leading) {
      if (comment.value.startsWith("// prettier-ignore")) {
        fake_print_comments(node);
        return node.source;
      }
    }
  }

  if (node.name === "Grammar") {
    return print_hard_list(node.children, options, print);
  }

  if (node.name === "Choice") {
    return print_choice(node.children, options, print);
  }

  if (node.name === "Body") {
    return indent(print_body(node, options, print));
  }

  if (node.name === "PrecedenceBody") {
    return indent(print_list(node.children, options, print));
  }

  // `a*`
  if (node.name === "Repeat") return [print(node.children[0]), "*"];
  // `a+`
  if (node.name === "Repeat1") return [print(node.children[0]), "+"];
  // `a?`
  if (node.name === "Optional") return [print(node.children[0]), "?"];

  // `(a)`
  // TODO? Remove parens when just single RuleName?
  // TODO Just hoping that there will always be a `(` and `)`,
  // .... but with incomplete syntax there doesn't have to be.
  if (node.name === "ParenExpression") {
    let content = node.children[1];
    let el = unwrap_parens(content);
    if (el) {
      return print(el);
    }
    return ["(", group([indent([softline, print(content)]), softline]), ")"];
  }

  if (node.name === "Sequence") {
    return node.children.map((x, i) =>
      i === node.children.length - 1
        ? print(x)
        : has_newline_after(x, options)
        ? [print(x), hardline]
        : [dont_break(print(x)), " "]
    );
  }

  // I guess?
  if (node.name === "BlockComment") {
    return node.source;
  }

  if (node.name === "DialectsDeclaration") {
    return group(join(" ", node.children.map(print)));
  }
  if (node.name === "@dialects") return node.source;
  if (node.name === "DialectBody") {
    return indent(print_list(node.children, options, print));
  }

  if (node.name === "RuleDeclaration") {
    return group(
      node.children.map((x, index) =>
        x.name === "ParamList" || x.name === "Props" || index === 0
          ? print(x)
          : [" ", print(x)]
      )
    );
  }

  if (node.name === "AmbiguityMarker") return node.source;

  if (node.name === "TokensDeclaration") {
    return group(join(" ", node.children.map(print)));
  }
  if (node.name === "@tokens") return node.source;
  if (node.name === "TokensBody") {
    return print_tokens_body(node.children, options, print);
  }
  if (node.name === "CharSet") return node.source;
  if (node.name === "InvertedCharSet") return node.source;
  if (node.name === "CharClass") return node.source;
  if (node.name === "LiteralTokenDeclaration") return node.source;

  if (node.name === "InlineRule" || node.name === "PrecedenceDeclaration") {
    return group(
      node.children.map((x, index) =>
        index === 0 || x.name === "Props" ? print(x) : [" ", print(x)]
      )
    );
  }

  // `kw<arg>`
  if (node.name === "Call") {
    return node.children.map(print);
  }
  if (node.name === "ArgList" || node.name === "ParamList") {
    return ["<", join(", ", node.children.map(print)), ">"];
  }

  if (node.name === "TokenPrecedenceDeclaration") {
    return group(join(" ", node.children.map(print)));
  }

  if (node.name === "TopSkipDeclaration") {
    return group(join(" ", node.children.map(print)));
  }

  if (node.name === "Props") {
    return print_props(node.children, options, print);
  }
  if (node.name === "Prop") return node.children.map(print);
  if (node.name === "AtName") return node.source;
  if (node.name === "=") return "=";
  if (node.name === "Name") return node.source;

  if (node.name === "ExternalTokensDeclaration") {
    return group(
      join(
        " ",
        node.children.map((x) =>
          x.name === "TokensBody"
            ? indent(print_list(x.children, options, print))
            : print(x)
        )
      )
    );
  }
  if (node.name === "tokens") return node.source;
  if (node.name === "Token") return node.children.map(print);

  if (node.name === "ContextDeclaration") {
    return group(join(" ", node.children.map(print)));
  }
  if (node.name === "@context") return node.source;

  if (node.name === "⚠") {
    return node.children.map(print);
  }

  if (
    node.name === "RuleName" ||
    node.name === "Precedence" ||
    node.name === "Literal" ||
    node.name === "PrecedenceMarker" ||
    node.name === "@precedence" ||
    node.name === "@top"
  ) {
    return node.source;
  }

  if (node.name === "Specialization") {
    return dont_break(node.children.map(print));
  }
  if (node.name === "@specialize") return node.source;
  if (node.name === "@extend") return node.source;
  if (node.name === "PropEsc")
    return node.children.map((x) =>
      x.name === "{" ? "{" : x.name === "}" ? "}" : print(x)
    );

  // `@external propSource lezerHighlighting from "./highlight"`
  if (node.name === "ExternalPropSourceDeclaration") {
    return join(" ", node.children.map(print));
  }
  if (node.name === "@external") return node.source;
  if (node.name === "propSource") return node.source;
  if (node.name === "from") return node.source;

  if (node.name === "AnyChar") return node.source;

  // `@detectDelim`
  if (node.name === "DetectDelimDeclaration") return node.source;

  if (node.name === "LocalTokensDeclaration") {
    return group(join(" ", node.children.map(print)));
  }
  if (node.name === "@local") return node.source;
  if (node.name === "ElseToken") {
    return group(
      node.children.map((x, i) =>
        x.name === "Props" || i === 0 ? print(x) : [" ", print(x)]
      )
    );
  }
  if (node.name === "@else") return node.source;

  if (node.name === "SkipScope") {
    return group(
      join(
        " ",
        node.children.map((x) =>
          x.name === "Body" ? group(print(x)) : print(x)
        )
      )
    );
  }
  if (node.name === "@skip") return node.source;
  if (node.name === "SkipBody") {
    return indent(print_list(node.children, options, print));
  }

  return group(`== {${node.name}} ==`);
};

let apply_comments = (
  /** @type {LezerNode} */ node,
  printed,
  /** @type {Options} */ options
) => {
  let leading_comments = [];
  let trailing_comments = [];

  for (let comment of node.comments ?? []) {
    if (comment.printed) continue;

    // console.log(`comment:`, comment);

    let comment_value = options.originalText.slice(comment.from, comment.to);
    if (comment.leading) {
      if (
        isPreviousLineEmpty(
          options.originalText,
          comment,
          (comment) => comment.from
        )
      ) {
        leading_comments.push(hardline);
      }

      try {
        if (comment.placement === "ownLine") {
          leading_comments.push([comment_value, hardline]);
          comment.printed = true;
          continue;
        } else if (comment.placement === "endOfLine") {
          // I feel like a leading "endOfLine" comment is kinda odd...
          leading_comments.push([comment_value, hardline]);
          comment.printed = true;
          continue;
        } else {
          leading_comments.push([comment_value, " "]);
          comment.printed = true;
          continue;
        }
      } finally {
        if (
          isNextLineEmpty(
            options.originalText,
            comment,
            (comment) => comment.to
          )
        ) {
          leading_comments.push(hardline);
        }
      }
    } else if (comment.trailing) {
      if (comment.placement === "ownLine") {
        trailing_comments.push([hardline, comment_value]);
        comment.printed = true;
        continue;
      } else if (comment.placement === "endOfLine") {
        trailing_comments.push([" ", breakParent, comment_value]);
        comment.printed = true;
        continue;
      } else {
        trailing_comments.push([" ", comment_value]);
        comment.printed = true;
        continue;
      }
    } else {
      // Hah!
      // IDK, but I'm just going to put this before the node
      leading_comments.push([comment_value, hardline]);
      comment.printed = true;
      continue;
    }
  }

  let value = [...leading_comments, printed, ...trailing_comments];
  if (value.length === 1) {
    return value[0];
  } else {
    return value;
  }
};

/**
 * @typedef Options
 * @type {{
 *  originalText: string
 * }}
 */

module.exports.printers = {
  lezer: {
    /**
     * @param {AstPath<LezerNode>} path
     * @param {Options} options
     * @param {(path: AstPath<LezerNode>) => import("prettier").Doc} _print
     * @returns {import("prettier").Doc}
     */
    print(path, options, _print) {
      let root_node = path.getValue();

      let print_with_comments_and_stuff = (node) => {
        let printed = print(node, options, print_with_comments_and_stuff);
        return apply_comments(node, printed, options);
      };
      let val = print_with_comments_and_stuff(root_node);
      return val;
    },

    getCommentChildNodes(node, options) {
      return node.children;
    },
    canAttachComment(node) {
      if (node.group?.includes("Expression")) return true;
      if (node.group?.includes("Declaration")) return true;

      if (node.name === "Precedence") return true;
      if (node.name === "Prop") return true;

      // console.log("Can't attach comment to", node.name);
      return false;
    },
  },
};
