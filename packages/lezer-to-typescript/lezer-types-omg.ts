export interface Node<Name extends string, Child extends Node<string> = any> {
  readonly name: Name;
  readonly children: Array<Child>;
  readonly source: string;
}

export type GrammarNode = Node<"Grammar", declarationNode>;

export type declarationNode =
  | RuleDeclarationNode
  | topRuleDeclarationNode
  | Node<
      "PrecedenceDeclaration",
      | atNode<Node<"@precedence">>
      | Node<
          "PrecedenceBody",
          | Node<"{">
          | Node<
              "Precedence",
              | PrecedenceNameNode
              | atNode<Node<"@left">>
              | atNode<Node<"@right">>
              | atNode<Node<"@cut">>
            >
          | Node<",">
          | Node<"}">
        >
    >
  | Node<
      "TokensDeclaration",
      | atNode<Node<"@tokens">>
      | Node<"TokensBody", Node<"{"> | tokenDeclarationNode | Node<"}">>
    >
  | Node<
      "LocalTokensDeclaration",
      | atNode<Node<"@local">>
      | kwNode<Node<"tokens">>
      | Node<
          "TokensBody",
          | Node<"{">
          | tokenDeclarationNode
          | Node<"ElseToken", atNode<Node<"@else">> | RuleNameNode | PropsNode>
          | Node<"}">
        >
    >
  | Node<
      "ExternalTokensDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"tokens">>
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
      | externalTokenSetNode
    >
  | Node<
      "ExternalPropDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"prop">>
      | NameNode
      | kwNode<Node<"as">>
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
    >
  | Node<
      "ExternalPropSourceDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"propSource">>
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
    >
  | Node<
      "ExternalSpecializeDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"extend">>
      | kwNode<Node<"specialize">>
      | BodyNode
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
      | externalTokenSetNode
    >
  | Node<
      "ContextDeclaration",
      atNode<Node<"@context">> | NameNode | kwNode<Node<"from">> | LiteralNode
    >
  | Node<
      "DialectsDeclaration",
      | atNode<Node<"@dialects">>
      | Node<"DialectBody", Node<"{"> | NameNode | Node<","> | Node<"}">>
    >
  | Node<"TopSkipDeclaration", atNode<Node<"@skip">> | BodyNode>
  | Node<
      "SkipScope",
      | atNode<Node<"@skip">>
      | BodyNode
      | Node<
          "SkipBody",
          Node<"{"> | RuleDeclarationNode | topRuleDeclarationNode | Node<"}">
        >
    >
  | Node<"DetectDelimDeclaration", atNode<Node<"@detectDelim">>>;

export type externalTokenSetNode = Node<
  "TokensBody",
  Node<"{"> | Node<"Token", RuleNameNode | PropsNode> | Node<","> | Node<"}">
>;

export type tokenDeclarationNode =
  | Node<
      "TokenPrecedenceDeclaration",
      | atNode<Node<"@precedence">>
      | Node<
          "PrecedenceBody",
          Node<"{"> | LiteralNode | nameExpressionNode | Node<","> | Node<"}">
        >
    >
  | Node<
      "TokenConflictDeclaration",
      | atNode<Node<"@conflict">>
      | Node<
          "ConflictBody",
          | Node<"{">
          | LiteralNode
          | nameExpressionNode
          | Node<",">
          | LiteralNode
          | nameExpressionNode
          | Node<"}">
        >
    >
  | Node<"LiteralTokenDeclaration", LiteralNode | PropsNode>
  | RuleDeclarationNode;

export type RuleDeclarationNode = Node<
  "RuleDeclaration",
  RuleNameNode | PropsNode | ParamListNode | BodyNode
>;

export type topRuleDeclarationNode = Node<
  "RuleDeclaration",
  atNode<Node<"@top">> | RuleNameNode | PropsNode | ParamListNode | BodyNode
>;

export type ParamListNode = Node<
  "ParamList",
  Node<"<"> | NameNode | Node<","> | NameNode | Node<">">
>;

export type BodyNode = Node<"Body", Node<"{"> | expressionNode | Node<"}">>;

export type PropsNode = Node<
  "Props",
  Node<"["> | PropNode | Node<","> | PropNode | Node<"]">
>;

export type PropNode = Node<
  "Prop",
  | AtNameNode
  | NameNode
  | Node<"=">
  | LiteralNode
  | NameNode
  | Node<".">
  | Node<"PropEsc", Node<"{"> | RuleNameNode | Node<"}">>
>;

export type expressionNode =
  | seqExpressionNode
  | Node<"Choice", seqExpressionNode | Node<"|"> | seqExpressionNode>;

export type seqExpressionNode =
  | atomExpressionNode
  | Node<
      "Sequence",
      | markerNode
      | atomExpressionNode
      | markerNode
      | atomExpressionNode
      | atomExpressionNode
      | markerNode
    >;

export type atomExpressionNode =
  | LiteralNode
  | CharSetNode
  | AnyCharNode
  | InvertedCharSetNode
  | nameExpressionNode
  | Node<"CharClass">
  | Node<"Optional", atomExpressionNode | Node<"?">>
  | Node<"Repeat", atomExpressionNode | Node<"*">>
  | Node<"Repeat1", atomExpressionNode | Node<"+">>
  | Node<"InlineRule", RuleNameNode | PropsNode | PropsNode | BodyNode>
  | Node<"ParenExpression", Node<"("> | expressionNode | Node<")">>
  | Node<
      "Specialization",
      | atNode<Node<"@specialize">>
      | atNode<Node<"@extend">>
      | PropsNode
      | ArgListNode
    >;

export type nameExpressionNode =
  | RuleNameNode
  | ScopedNameNode
  | Node<"Call", RuleNameNode | ScopedNameNode | ArgListNode>;

export type markerNode =
  | Node<"PrecedenceMarker", Node<"!"> | PrecedenceNameNode>
  | Node<"AmbiguityMarker", Node<"~"> | NameNode>;

export type ScopedNameNode = Node<
  "ScopedName",
  RuleNameNode | Node<"."> | RuleNameNode
>;

export type ArgListNode = Node<
  "ArgList",
  Node<"<"> | expressionNode | Node<","> | expressionNode | Node<">">
>;

export type RuleNameNode = Node<"RuleName", nameNode>;

export type PrecedenceNameNode = Node<"PrecedenceName", nameNode>;

export type NameNode = Node<"Name", Node<"a", nameNode>>;

export type kwNode<valueNode> = valueNode;

export type atNode<valueNode> = valueNode;

type whitespaceNode = never;

type LineCommentNode = Node<"LineComment">;

type BlockCommentNode = Node<"BlockComment">;

type blockCommentRestNode = never;

type blockCommentAfterStarNode = never;

type nameNode = never;

type AnyCharNode = Node<"AnyChar">;

type keywordNode = never;

type AtNameNode = Node<"AtName">;

type LiteralNode = Node<"Literal">;

type CharSetNode = Node<"CharSet">;

type InvertedCharSetNode = Node<"InvertedCharSet">;

export type AllNodes =
  | GrammarNode
  | Node<
      "Precedence",
      | PrecedenceNameNode
      | atNode<Node<"@left">>
      | atNode<Node<"@right">>
      | atNode<Node<"@cut">>
    >
  | Node<
      "PrecedenceBody",
      | Node<"{">
      | Node<
          "Precedence",
          | PrecedenceNameNode
          | atNode<Node<"@left">>
          | atNode<Node<"@right">>
          | atNode<Node<"@cut">>
        >
      | Node<",">
      | Node<"}">
    >
  | Node<
      "PrecedenceDeclaration",
      | atNode<Node<"@precedence">>
      | Node<
          "PrecedenceBody",
          | Node<"{">
          | Node<
              "Precedence",
              | PrecedenceNameNode
              | atNode<Node<"@left">>
              | atNode<Node<"@right">>
              | atNode<Node<"@cut">>
            >
          | Node<",">
          | Node<"}">
        >
    >
  | Node<"TokensBody", Node<"{"> | tokenDeclarationNode | Node<"}">>
  | Node<
      "TokensDeclaration",
      | atNode<Node<"@tokens">>
      | Node<"TokensBody", Node<"{"> | tokenDeclarationNode | Node<"}">>
    >
  | Node<"ElseToken", atNode<Node<"@else">> | RuleNameNode | PropsNode>
  | Node<
      "TokensBody",
      | Node<"{">
      | tokenDeclarationNode
      | Node<"ElseToken", atNode<Node<"@else">> | RuleNameNode | PropsNode>
      | Node<"}">
    >
  | Node<
      "LocalTokensDeclaration",
      | atNode<Node<"@local">>
      | kwNode<Node<"tokens">>
      | Node<
          "TokensBody",
          | Node<"{">
          | tokenDeclarationNode
          | Node<"ElseToken", atNode<Node<"@else">> | RuleNameNode | PropsNode>
          | Node<"}">
        >
    >
  | Node<
      "ExternalTokensDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"tokens">>
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
      | externalTokenSetNode
    >
  | Node<
      "ExternalPropDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"prop">>
      | NameNode
      | kwNode<Node<"as">>
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
    >
  | Node<
      "ExternalPropSourceDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"propSource">>
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
    >
  | Node<
      "ExternalSpecializeDeclaration",
      | atNode<Node<"@external">>
      | kwNode<Node<"extend">>
      | kwNode<Node<"specialize">>
      | BodyNode
      | NameNode
      | kwNode<Node<"from">>
      | LiteralNode
      | externalTokenSetNode
    >
  | Node<
      "ContextDeclaration",
      atNode<Node<"@context">> | NameNode | kwNode<Node<"from">> | LiteralNode
    >
  | Node<"DialectBody", Node<"{"> | NameNode | Node<","> | Node<"}">>
  | Node<
      "DialectsDeclaration",
      | atNode<Node<"@dialects">>
      | Node<"DialectBody", Node<"{"> | NameNode | Node<","> | Node<"}">>
    >
  | Node<"TopSkipDeclaration", atNode<Node<"@skip">> | BodyNode>
  | Node<
      "SkipBody",
      Node<"{"> | RuleDeclarationNode | topRuleDeclarationNode | Node<"}">
    >
  | Node<
      "SkipScope",
      | atNode<Node<"@skip">>
      | BodyNode
      | Node<
          "SkipBody",
          Node<"{"> | RuleDeclarationNode | topRuleDeclarationNode | Node<"}">
        >
    >
  | Node<"DetectDelimDeclaration", atNode<Node<"@detectDelim">>>
  | declarationNode
  | Node<"Token", RuleNameNode | PropsNode>
  | externalTokenSetNode
  | Node<
      "PrecedenceBody",
      Node<"{"> | LiteralNode | nameExpressionNode | Node<","> | Node<"}">
    >
  | Node<
      "TokenPrecedenceDeclaration",
      | atNode<Node<"@precedence">>
      | Node<
          "PrecedenceBody",
          Node<"{"> | LiteralNode | nameExpressionNode | Node<","> | Node<"}">
        >
    >
  | Node<
      "ConflictBody",
      | Node<"{">
      | LiteralNode
      | nameExpressionNode
      | Node<",">
      | LiteralNode
      | nameExpressionNode
      | Node<"}">
    >
  | Node<
      "TokenConflictDeclaration",
      | atNode<Node<"@conflict">>
      | Node<
          "ConflictBody",
          | Node<"{">
          | LiteralNode
          | nameExpressionNode
          | Node<",">
          | LiteralNode
          | nameExpressionNode
          | Node<"}">
        >
    >
  | Node<"LiteralTokenDeclaration", LiteralNode | PropsNode>
  | tokenDeclarationNode
  | RuleDeclarationNode
  | topRuleDeclarationNode
  | ParamListNode
  | BodyNode
  | PropsNode
  | Node<"PropEsc", Node<"{"> | RuleNameNode | Node<"}">>
  | PropNode
  | Node<"Choice", seqExpressionNode | Node<"|"> | seqExpressionNode>
  | expressionNode
  | Node<
      "Sequence",
      | markerNode
      | atomExpressionNode
      | markerNode
      | atomExpressionNode
      | atomExpressionNode
      | markerNode
    >
  | seqExpressionNode
  | Node<"CharClass">
  | Node<"Optional", atomExpressionNode | Node<"?">>
  | Node<"Repeat", atomExpressionNode | Node<"*">>
  | Node<"Repeat1", atomExpressionNode | Node<"+">>
  | Node<"InlineRule", RuleNameNode | PropsNode | PropsNode | BodyNode>
  | Node<"ParenExpression", Node<"("> | expressionNode | Node<")">>
  | Node<
      "Specialization",
      | atNode<Node<"@specialize">>
      | atNode<Node<"@extend">>
      | PropsNode
      | ArgListNode
    >
  | atomExpressionNode
  | Node<"Call", RuleNameNode | ScopedNameNode | ArgListNode>
  | nameExpressionNode
  | Node<"PrecedenceMarker", Node<"!"> | PrecedenceNameNode>
  | Node<"AmbiguityMarker", Node<"~"> | NameNode>
  | markerNode
  | ScopedNameNode
  | ArgListNode
  | RuleNameNode
  | PrecedenceNameNode
  | Node<"a", nameNode>
  | NameNode
  | Node<"LineComment">
  | Node<"BlockComment">
  | Node<"AnyChar">
  | Node<"AtName">
  | Node<"Literal">
  | Node<"CharSet">
  | Node<"InvertedCharSet">
  | Node<"{">
  | Node<"}">
  | Node<"(">
  | Node<")">
  | Node<"[">
  | Node<"]">
  | Node<"=">
  | Node<".">
  | Node<"|">
  | Node<"!">
  | Node<"~">
  | Node<"*">
  | Node<"+">
  | Node<"?">;
