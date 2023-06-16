import { SyntaxNode, Tree } from "@lezer/common";
import { parser } from "@lezer/lezer";
import dedent from "string-dedent";
import * as AST from "./lezer-ast.cjs";
import fs from "fs/promises";

import type {
  GrammarNode,
  AllNodes,
  Node,
  expressionNode,
} from "./lezer-types-omg";

let source = await fs.readFile("./grammar.grammar", "utf-8");

let parse_call = (call: EZNode<"Call">) => {
  let children = Array.from(call.children);
  let name = get_rule_name(call);
  let args = children.find(has_name("ArgList"));

  return {
    type: "call",
    name: name,
    args: args?.children.map((x) => x.source) ?? [],
    source: call.source,
  } as const;
};

let get_name_from_props = (expression: EZNode<"Props"> | null) => {
  if (expression == null) return null;

  let props = expression.children.filter(has_name("Prop"));
  for (let prop of props) {
    let name = prop.children.find(has_name("AtName"))?.source;
    if (name === "@name") {
      let name = prop.children.find(has_name("Name"))?.source;
      if (name != null) {
        // TODO Remove quotes from literal?
        return name;
      }

      let prop_esc = prop.children.find(has_name("PropEsc"));
      if (prop_esc != null) {
        return prop_esc.children.find(has_name("RuleName"))?.source;
      }

      throw new Error("No PropEsc or Name in Prop");
    }
  }
};

type ExpressionNode = Exclude<EZNode<"Body">["children"]["0"], Node<"{" | "}">>;

type ExpressionAST =
  | string
  | { literal: string }
  | { type: "specialization"; name: string }
  | { type: "call"; name: string; args: string[]; source: string }
  | { type: "inline_rule"; name: string; expression: ExpressionAST[] };

let parse_expression = (
  expression: ExpressionNode,
  params: string[] = [],
  parse: (expression: ExpressionNode) => ExpressionAST[]
): ExpressionAST[] => {
  if (expression.name === "RuleName") {
    return [expression.source];
  } else if (expression.name === "Choice") {
    return expression.children.filter(not_has_name("|")).map(parse).flat();
  } else if (expression.name === "Sequence") {
    return expression.children
      .filter(not_has_name("PrecedenceMarker", "AmbiguityMarker"))
      .map(parse)
      .flat();
  } else if (expression.name === "Literal") {
    return [{ literal: expression.source }];
  } else if (expression.name === "Optional") {
    return expression.children.filter(not_has_name("?")).map(parse).flat();
  } else if (expression.name === "Repeat") {
    return expression.children.filter(not_has_name("*")).map(parse).flat();
  } else if (expression.name === "Repeat1") {
    return expression.children.filter(not_has_name("+")).map(parse).flat();
  } else if (expression.name === "ParenExpression") {
    return expression.children.filter(not_has_name("(", ")")).map(parse).flat();
  } else if (expression.name === "Call") {
    return [parse_call(expression)];
  } else if (expression.name === "Specialization") {
    let props = expression.children.find(has_name("Props"));
    let name = props && get_name_from_props(props);

    if (name == null) return [];

    return [
      {
        type: "specialization",
        name: name,
      },
    ];
  } else if (expression.name === "InlineRule") {
    let name = get_rule_name(expression);
    // TODO Check for anonimity
    let body_expression = expression.children
      .find(has_name("Body"))
      ?.children.find(not_has_name("{", "}"));

    if (body_expression == null) return [];

    let subexpression = parse_expression_with_params(body_expression, params);

    return [
      {
        type: "inline_rule",
        name,
        expression: subexpression,
      },
    ];
  } else {
    throw new Error(`Unexpected expression: ${expression.name}`);
  }
};

let parse_expression_with_params = (
  expression: expressionNode,
  params: string[] = []
) => {
  let parse = (x: expressionNode) => parse_expression(x, params, parse);
  return parse(expression);
};

let parse_rule = (rule: EZNode<"RuleDeclaration">) => {
  // Need this for typescript?
  let children = Array.from(rule.children);

  let id = children.find(has_name("RuleName"))?.source;
  let name = get_rule_name(rule) ?? id;

  if (name == null) throw new Error("RuleDeclaration without RuleName");

  let x = children.find(has_name("ParamList"));
  let params = x?.children.map((x) => x.source);

  let body_expression = children
    .find(has_name("Body"))
    ?.children.find(not_has_name("{", "}"));

  if (body_expression == null) throw new Error("RuleDeclaration without Body");

  let expression = parse_expression_with_params(body_expression, params);

  let is_top = children.find(has_name("@top")) != null;

  return {
    id,
    type: "rule",
    is_top,
    is_anonymous: is_anonymous_rule(rule),
    name,
    expression,
    params,
  };
};

let get_rule_name = (
  rule: EZNode<"InlineRule" | "RuleDeclaration" | "Call">
) => {
  // @ts-ignore
  let children = Array.from(rule.children);
  let naive_name = children.find(has_name("RuleName"))?.source;

  let props = children.find(has_name("Props")) as any as EZNode<"Props">;
  let name_from_props = get_name_from_props(props);
  if (name_from_props) {
    return name_from_props;
  }

  return naive_name;
};

let is_anonymous_rule = (
  rule: EZNode<"InlineRule" | "RuleDeclaration" | "Call">
) => {
  // @ts-ignore
  let children = Array.from(rule.children);

  let naive_name = children.find(has_name("RuleName"))?.source;

  let props = children.find(has_name("Props")) as any as EZNode<"Props">;
  let name_from_props = get_name_from_props(props);
  if (name_from_props) {
    return false;
  }

  if (naive_name?.toLowerCase()[0] !== naive_name?.[0]) {
    return false;
  } else {
    return true;
  }
};

let has_name = <const T extends AllNodes["name"]>(name: T) => {
  return function has_name<N extends Node<any, any>>(
    x: N
  ): x is Extract<N, Node<T, any>> {
    return x.name === name;
  };
};

let not_has_name = <const T extends AllNodes["name"]>(...names: Array<T>) => {
  return function has_name<N extends Node<any, any>>(
    x: N
  ): x is Exclude<N, Node<T, any>> {
    return names.includes(x.name) === false;
  };
};

type EZNode<N extends AllNodes["name"]> = Extract<AllNodes, { name: N }>;

type DeclarationNode = GrammarNode["children"][0];

type CoverAllCases<L extends Node<any, any>> = {
  [K in L["name"]]: ((x: Extract<L, { name: K }>) => void) | null;
};

let NOOP = () => {};

let cst_to_ast = (source: string) => {
  let cst = parser.parse(source).topNode;

  let rules = {};

  let as_object = AST.to_simple_object(cst, source) as GrammarNode;
  let top_rule = null;

  let rule_types = {
    ExternalSpecializeDeclaration: null,
    ExternalTokensDeclaration: null,
    LocalTokensDeclaration: null,
    SkipScope: null,
    RuleDeclaration: (cst_rule) => {
      let rule = parse_rule(cst_rule);
      rules[rule.id ?? rule.name] = rule;
      if (rule.is_top) {
        top_rule = rule.name;
      }
    },
    TokensDeclaration: (cst_rule) => {
      // let tokens_body = cst_rule.children.find(x => x.name === "TokensBody") as EZNode<"TokensBody">;
      let tokens_body = cst_rule.children.find(has_name("TokensBody"));
      tokens_body.children;
      for (let token of tokens_body.children) {
        if (token.name === "LiteralTokenDeclaration") {
          let name = token.source;
          rules[name] = { type: "literal", name: name };
        } else if (token.name === "RuleDeclaration") {
          let name = get_rule_name(token);
          if (is_anonymous_rule(token)) {
            rules[name] = { type: "anonymous-token", name: name };
          } else {
            rules[name] = { type: "token", name: name };
          }
        } else {
          token.name;
        }
      }
    },

    // TODO Eventually make dialects part of the types?
    // .... Is that even possible???
    DialectsDeclaration: NOOP,

    ContextDeclaration: NOOP,
    DetectDelimDeclaration: NOOP,
    ExternalPropDeclaration: NOOP,
    ExternalPropSourceDeclaration: NOOP,
    PrecedenceDeclaration: NOOP,
    TopSkipDeclaration: NOOP,
  } satisfies CoverAllCases<DeclarationNode>;

  for (let cst_rule of as_object.children) {
    if (rule_types[cst_rule.name] == null) {
      throw new Error(`Unknown rule type: ${cst_rule.name}`);
    }
    rule_types[cst_rule.name](cst_rule);
  }

  return { rules, top_rule };
};

let ast = cst_to_ast(source) as any;

// console.log(`rules.rules:`, rules.rules);
// console.log(`rules:`, rules.rules[rules.top_rule].expression);

let all_rules = [];

let print_expression = (expression: any, has_params) => {
  if (typeof expression === "string") {
    // TODO: This is a hack
    if (expression.startsWith('"')) {
      return `Node<${expression}>`;
    }
    return `${expression}Node`;
  } else if (expression.literal != null) {
    return `Node<${expression.literal}>`;
  } else if (expression.type === "call") {
    let value = `${expression.name}Node<${expression.args
      .map((x) => print_expression(x, has_params))
      .join(", ")}>`;
    all_rules.push(value);
    return value;
  } else if (expression.type === "specialization") {
    return `${expression.name}Node`;
  } else if (expression.type === "inline_rule" || expression.type === "rule") {
    if (expression.is_anonymous) {
      let children = expression.expression
        .map((x) => print_expression(x, has_params))
        .join(" | ");
      return children;
    }

    if (expression.expression.length === 0) {
      let x = `Node<"${expression.name}">`;
      if (!has_params && expression.type === "inline_rule") all_rules.push(x);
      return x;
    } else {
      let children = expression.expression
        .map((x) => print_expression(x, has_params))
        .join(" | ");
      let x = `Node<"${expression.name}", Array<${children}>>`;
      if (!has_params && expression.type === "inline_rule") all_rules.push(x);
      return x;
    }
  } else {
    console.warn(expression);
    return "TODO";
  }
};
let top_names = Object.values(ast.rules)
  .map((rule: any) => {
    if (rule.type === "rule") {
      // let do_export = rule.is_top ? "export " : "";
      let do_export = "export ";

      let params =
        rule.params?.length > 0
          ? `<${rule.params.map((x) => `${x}Node`).join(", ")}>`
          : "";

      let value = print_expression(rule, rule.params?.length > 0);
      if (params.length === 0) all_rules.push(`${rule.id}Node`);

      return dedent`
        ${do_export}type ${rule.id}Node${params} = ${value}
      `;
    } else if (rule.type === "literal") {
      all_rules.push(`Node<${rule.name}>`);
      return null;
    } else if (rule.type === "token") {
      all_rules.push(`Node<"${rule.name}">`);
      return `type ${rule.name}Node = Node<"${rule.name}">`;
    } else if (rule.type === "anonymous-token") {
      return `type ${rule.name}Node = never`;
    } else {
      throw new Error(`Unexpected rule type: ${rule.type}`);
    }
  })
  .filter((x) => x != null)
  .join("\n\n");

let all_rules_string = all_rules.join(" | ");

console.log(dedent`
  export interface Node<Name extends string, Children extends any[] = never[]> {
    name: Name;
    children: Children;
    source: string;
  }
  
  ${top_names}

  export type AllNodes = ${all_rules_string}
`);
