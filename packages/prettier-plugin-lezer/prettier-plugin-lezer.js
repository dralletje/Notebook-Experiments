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
      // console.log(`options:`, options);
      // return parsers.lezer.parse(text, options);
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

/**
 * @param {LezerNode} node
 * @param {{ [key: string]: (path: LezerNode) => import("prettier").Doc }} options
 */
let switch_node = (node, options) => {
  let handler = options[node.name];
  if (handler != null) {
    return handler(node);
  } else {
    throw new Error(`Unhandled node type "${node.name}"`);
  }
};

let has_newline_before = (
  /** @type {LezerNode} */ node,
  /** @type {Options} */ options
) => {
  let end_previous = skipWhitespace(options.originalText, node.from, {
    backwards: true,
  });
  if (!end_previous) return false;
  return options.originalText.slice(end_previous, node.from).includes("\n");
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
  // return [];
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
  return nodes.map((node, index) => {
    if (node.name === "{") return ["{"];
    if (node.name === "}") return dedent([line, "}"]);
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

/**
 * @template S
 * @template T
 * @param {S} separator
 * @param {Array<T>} nodes
 * @returns {Array<S | T>}
 */
let interleave = (separator, nodes) => {
  return nodes.flatMap((x, i) => (i === 0 ? [x] : [separator, x]));
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
      parts.push(dedent([hardline, "}"]));
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

/** @returns {import("prettier").Doc} */
let dont_break = (/** @type {import("prettier").Doc} */ doc) => {
  if (typeof doc === "string") {
    return doc;
  }
  if (Array.isArray(doc)) {
    return doc.map(dont_break);
  }
  if (doc.type === "group") {
    return {
      ...doc,
      contents: dont_break(doc.contents),
    };
  }
  if (doc.type === "line") {
    if (doc.soft) return "";
    if (doc.hard) return "";
    return " ";
  }
  if (doc.type === "concat") {
    return { type: "concat", parts: doc.parts.map(dont_break) };
  }
  if (doc.type === "indent") {
    return { type: "indent", contents: dont_break(doc.contents) };
  }
  if (doc.type === "align") {
    return { type: "align", contents: dont_break(doc.contents), n: doc.n };
  }
  if (doc.type === "break-parent") {
    return "";
  }

  console.warn(`DOC TYPE THAT dont_break DOESNT UNDERSTAND:`, doc);
  return doc;
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

class LezerPath {
  /** @type {LezerNode} */ node;
  /** @type {LezerPath | null} */ parent;
  /** @type {number | null} */ index;
  constructor(
    /** @type {LezerNode} */ node,
    /** @type {LezerPath | null} */ parent,
    /** @type {number | null} */ index
  ) {
    this.node = node;
    this.parent = parent;
    this.index = index;
  }

  get comments() {
    return this.node.comments;
  }
  get name() {
    return this.node.name;
  }
  get source() {
    return this.node.source;
  }
  get children() {
    return this.node.children.map((x) => new LezerPath(this.path.concat(x)));
  }
}

/** @returns {import("prettier").Doc} */
let print = (
  /** @type {LezerPath} */ node,
  /** @type {Options} */ options,
  /** @type {(node: LezerNode) => import("prettier").Doc} */ print
) => {
  for (let comment of node.comments ?? []) {
    if (comment.leading && comment.placement === "ownLine") {
      if (comment.value.startsWith("// prettier-ignore")) {
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
    return indent(node.children.map(print));
    // return indent(
    //   node.children.map((x) =>
    //     x.name === "{" ? "{" : x.name === "}" ? "}" : print(x)
    //   )
    // );
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
  // if (node.name === "Sequence") {
  //   let init = node.children.slice(0, -1);
  //   let last = node.children[node.children.length - 1];

  //   return join(
  //     " ",
  //     init
  //       .map((x) => dont_break(print(x)))
  //       .concat(last == null ? [] : [print(last)])
  //   );
  // }
  // if (node.name === "Sequence") {
  //   return dont_break(print_list(node.children, options, print));
  // }
  // if (node.name === "Sequence") {
  //   let [first, ...rest] = node.children;
  //   return dont_break([
  //     print(first),
  //     ...rest.map((x) => [has_space_before(x, options) ? " " : [], print(x)]),
  //   ]);
  // }

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
            ? print_list(x.children, options, print)
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

  // if (node.name === "LineComment") {
  //   return [
  //     /\n *$/.test(node.root_source.slice(0, node.from)) ? hardline : [],
  //     node.source,
  //     ifBreak([], hardline),
  //   ];
  // }

  // Removed Breed because it is formatted just like all the rest
  // if (node.name === "Breed") {
  //   return join(" ", node.children.map(print));
  // }

  if (node.name === "⚠") {
    return node.children.map(print);
  }

  if (node.name === "{") return ["{", line];
  if (node.name === "}") return dedent([line, "}"]);

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
  // console.log(`printed:`, printed);
  let leading_comments = [];
  let trailing_comments = [];
  for (let comment of node.comments ?? []) {
    if (comment.printed) continue;

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
          leading_comments.push([comment.value, hardline]);
          comment.printed = true;
          continue;
        } else if (comment.placement === "endOfLine") {
          // I feel like a leading "endOfLine" comment is kinda odd...
          leading_comments.push([comment.value, hardline]);
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
        trailing_comments.push([hardline, comment.value]);
        comment.printed = true;
        continue;
      } else if (comment.placement === "endOfLine") {
        trailing_comments.push([" ", breakParent, comment.value]);
        comment.printed = true;
        continue;
      }
    }

    console.error(`Comment not printed:`, comment, "on node", node);
    throw new Error("Comment not printed!");
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

      // console.log(
      //   `val:`,
      //   JSON.stringify(
      //     root_node,
      //     (x, y) => {
      //       if (x === "root_source") return null;
      //       if (x === "source") {
      //         if (y.length > 20) {
      //           return y.slice(0, 9) + "..." + y.slice(-9);
      //         }
      //       }
      //       return y;
      //     },
      //     2
      //   )
      // );

      let print_with_comments_and_stuff = (node) => {
        let printed = print(node, options, print_with_comments_and_stuff);
        return apply_comments(node, printed, options);
      };
      let val = print_with_comments_and_stuff(root_node);
      return val;
    },

    getCommentChildNodes(
      // The node whose children should be returned.
      node,
      options
    ) {
      return node.children;
    },
    canAttachComment(node) {
      // return (
      //   node.name === "Variable" ||
      //   node.name === "Call" ||
      //   node.name === "ImplicitBlock" ||
      //   node.name === "[" ||
      //   node.name === "Block" ||
      //   node.name === "Line" ||
      //   node.name === "List"
      // );

      if (node.group?.includes("Expression")) return true;
      if (node.group?.includes("Declaration")) return true;
      if (node.name === "RuleDeclaration" || node.name === "Prop") {
        return true;
      } else {
        // console.log(`ATTACH COMMENT? node:`, node.name);
        return false;
      }
    },
    // printComment(commentPath, options) {
    //   console.log(`commentPath:`, commentPath);
    //   return commentPath.getValue().source;
    // },
  },
};
