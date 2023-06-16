export interface Node<Name extends string, Children extends any[] = []> {
  name: Name;
  children: Children;
  source: string;
}

export type GrammarNode = Node<"Grammar", Array<declarationNode>>;

export type declarationNode =
  | RuleDeclarationNode
  | topRuleDeclarationNode
  | Node<
      "PrecedenceDeclaration",
      Array<
        | atNode<Node<"@precedence">>
        | Node<
            "PrecedenceBody",
            Array<
              | Node<"{">
              | Node<
                  "Precedence",
                  Array<
                    | PrecedenceNameNode
                    | atNode<Node<"@left">>
                    | atNode<Node<"@right">>
                    | atNode<Node<"@cut">>
                  >
                >
              | Node<",">
              | Node<"}">
            >
          >
      >
    >
  | Node<
      "TokensDeclaration",
      Array<
        | atNode<Node<"@tokens">>
        | Node<
            "TokensBody",
            Array<Node<"{"> | tokenDeclarationNode | Node<"}">>
          >
      >
    >
  | Node<
      "LocalTokensDeclaration",
      Array<
        | atNode<Node<"@local">>
        | kwNode<Node<"tokens">>
        | Node<
            "TokensBody",
            Array<
              | Node<"{">
              | tokenDeclarationNode
              | Node<
                  "ElseToken",
                  Array<atNode<Node<"@else">> | RuleNameNode | PropsNode>
                >
              | Node<"}">
            >
          >
      >
    >
  | Node<
      "ExternalTokensDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"tokens">>
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
        | externalTokenSetNode
      >
    >
  | Node<
      "ExternalPropDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"prop">>
        | NameNode
        | kwNode<Node<"as">>
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
      >
    >
  | Node<
      "ExternalPropSourceDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"propSource">>
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
      >
    >
  | Node<
      "ExternalSpecializeDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"extend">>
        | kwNode<Node<"specialize">>
        | BodyNode
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
        | externalTokenSetNode
      >
    >
  | Node<
      "ContextDeclaration",
      Array<
        atNode<Node<"@context">> | NameNode | kwNode<Node<"from">> | LiteralNode
      >
    >
  | Node<
      "DialectsDeclaration",
      Array<
        | atNode<Node<"@dialects">>
        | Node<
            "DialectBody",
            Array<Node<"{"> | NameNode | Node<","> | Node<"}">>
          >
      >
    >
  | Node<"TopSkipDeclaration", Array<atNode<Node<"@skip">> | BodyNode>>
  | Node<
      "SkipScope",
      Array<
        | atNode<Node<"@skip">>
        | BodyNode
        | Node<
            "SkipBody",
            Array<
              | Node<"{">
              | RuleDeclarationNode
              | topRuleDeclarationNode
              | Node<"}">
            >
          >
      >
    >
  | Node<"DetectDelimDeclaration", Array<atNode<Node<"@detectDelim">>>>;

export type externalTokenSetNode = Node<
  "TokensBody",
  Array<
    | Node<"{">
    | Node<"Token", Array<RuleNameNode | PropsNode>>
    | Node<",">
    | Node<"}">
  >
>;

export type tokenDeclarationNode =
  | Node<
      "TokenPrecedenceDeclaration",
      Array<
        | atNode<Node<"@precedence">>
        | Node<
            "PrecedenceBody",
            Array<
              | Node<"{">
              | LiteralNode
              | nameExpressionNode
              | Node<",">
              | Node<"}">
            >
          >
      >
    >
  | Node<
      "TokenConflictDeclaration",
      Array<
        | atNode<Node<"@conflict">>
        | Node<
            "ConflictBody",
            Array<
              | Node<"{">
              | LiteralNode
              | nameExpressionNode
              | Node<",">
              | LiteralNode
              | nameExpressionNode
              | Node<"}">
            >
          >
      >
    >
  | Node<"LiteralTokenDeclaration", Array<LiteralNode | PropsNode>>
  | RuleDeclarationNode;

export type RuleDeclarationNode = Node<
  "RuleDeclaration",
  Array<RuleNameNode | PropsNode | ParamListNode | BodyNode>
>;

export type topRuleDeclarationNode = Node<
  "RuleDeclaration",
  Array<
    atNode<Node<"@top">> | RuleNameNode | PropsNode | ParamListNode | BodyNode
  >
>;

export type ParamListNode = Node<
  "ParamList",
  Array<Node<"<"> | NameNode | Node<","> | NameNode | Node<">">>
>;

export type BodyNode = Node<
  "Body",
  Array<Node<"{"> | expressionNode | Node<"}">>
>;

export type PropsNode = Node<
  "Props",
  Array<Node<"["> | PropNode | Node<","> | PropNode | Node<"]">>
>;

export type PropNode = Node<
  "Prop",
  Array<
    | AtNameNode
    | NameNode
    | Node<"=">
    | LiteralNode
    | NameNode
    | Node<".">
    | Node<"PropEsc", Array<Node<"{"> | RuleNameNode | Node<"}">>>
  >
>;

export type expressionNode =
  | seqExpressionNode
  | Node<"Choice", Array<seqExpressionNode | Node<"|"> | seqExpressionNode>>;

export type seqExpressionNode =
  | atomExpressionNode
  | Node<
      "Sequence",
      Array<
        | markerNode
        | atomExpressionNode
        | markerNode
        | atomExpressionNode
        | atomExpressionNode
        | markerNode
      >
    >;

export type atomExpressionNode =
  | LiteralNode
  | CharSetNode
  | AnyCharNode
  | InvertedCharSetNode
  | nameExpressionNode
  | Node<"CharClass">
  | Node<"Optional", Array<atomExpressionNode | Node<"?">>>
  | Node<"Repeat", Array<atomExpressionNode | Node<"*">>>
  | Node<"Repeat1", Array<atomExpressionNode | Node<"+">>>
  | Node<"InlineRule", Array<RuleNameNode | PropsNode | PropsNode | BodyNode>>
  | Node<"ParenExpression", Array<Node<"("> | expressionNode | Node<")">>>
  | Node<
      "Specialization",
      Array<
        | atNode<Node<"@specialize">>
        | atNode<Node<"@extend">>
        | PropsNode
        | ArgListNode
      >
    >;

export type nameExpressionNode =
  | RuleNameNode
  | ScopedNameNode
  | Node<"Call", Array<RuleNameNode | ScopedNameNode | ArgListNode>>;

export type markerNode =
  | Node<"PrecedenceMarker", Array<Node<"!"> | PrecedenceNameNode>>
  | Node<"AmbiguityMarker", Array<Node<"~"> | NameNode>>;

export type ScopedNameNode = Node<
  "ScopedName",
  Array<RuleNameNode | Node<"."> | RuleNameNode>
>;

export type ArgListNode = Node<
  "ArgList",
  Array<Node<"<"> | expressionNode | Node<","> | expressionNode | Node<">">>
>;

export type RuleNameNode = Node<"RuleName", Array<nameNode>>;

export type PrecedenceNameNode = Node<"PrecedenceName", Array<nameNode>>;

export type NameNode = Node<"Name", Array<Node<"a", Array<nameNode>>>>;

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
  | atNode<Node<"@precedence">>
  | atNode<Node<"@left">>
  | atNode<Node<"@right">>
  | atNode<Node<"@cut">>
  | Node<
      "Precedence",
      Array<
        | PrecedenceNameNode
        | atNode<Node<"@left">>
        | atNode<Node<"@right">>
        | atNode<Node<"@cut">>
      >
    >
  | Node<
      "PrecedenceBody",
      Array<
        | Node<"{">
        | Node<
            "Precedence",
            Array<
              | PrecedenceNameNode
              | atNode<Node<"@left">>
              | atNode<Node<"@right">>
              | atNode<Node<"@cut">>
            >
          >
        | Node<",">
        | Node<"}">
      >
    >
  | Node<
      "PrecedenceDeclaration",
      Array<
        | atNode<Node<"@precedence">>
        | Node<
            "PrecedenceBody",
            Array<
              | Node<"{">
              | Node<
                  "Precedence",
                  Array<
                    | PrecedenceNameNode
                    | atNode<Node<"@left">>
                    | atNode<Node<"@right">>
                    | atNode<Node<"@cut">>
                  >
                >
              | Node<",">
              | Node<"}">
            >
          >
      >
    >
  | atNode<Node<"@tokens">>
  | Node<"TokensBody", Array<Node<"{"> | tokenDeclarationNode | Node<"}">>>
  | Node<
      "TokensDeclaration",
      Array<
        | atNode<Node<"@tokens">>
        | Node<
            "TokensBody",
            Array<Node<"{"> | tokenDeclarationNode | Node<"}">>
          >
      >
    >
  | atNode<Node<"@local">>
  | kwNode<Node<"tokens">>
  | atNode<Node<"@else">>
  | Node<"ElseToken", Array<atNode<Node<"@else">> | RuleNameNode | PropsNode>>
  | Node<
      "TokensBody",
      Array<
        | Node<"{">
        | tokenDeclarationNode
        | Node<
            "ElseToken",
            Array<atNode<Node<"@else">> | RuleNameNode | PropsNode>
          >
        | Node<"}">
      >
    >
  | Node<
      "LocalTokensDeclaration",
      Array<
        | atNode<Node<"@local">>
        | kwNode<Node<"tokens">>
        | Node<
            "TokensBody",
            Array<
              | Node<"{">
              | tokenDeclarationNode
              | Node<
                  "ElseToken",
                  Array<atNode<Node<"@else">> | RuleNameNode | PropsNode>
                >
              | Node<"}">
            >
          >
      >
    >
  | atNode<Node<"@external">>
  | kwNode<Node<"tokens">>
  | kwNode<Node<"from">>
  | Node<
      "ExternalTokensDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"tokens">>
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
        | externalTokenSetNode
      >
    >
  | atNode<Node<"@external">>
  | kwNode<Node<"prop">>
  | kwNode<Node<"as">>
  | kwNode<Node<"from">>
  | Node<
      "ExternalPropDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"prop">>
        | NameNode
        | kwNode<Node<"as">>
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
      >
    >
  | atNode<Node<"@external">>
  | kwNode<Node<"propSource">>
  | kwNode<Node<"from">>
  | Node<
      "ExternalPropSourceDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"propSource">>
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
      >
    >
  | atNode<Node<"@external">>
  | kwNode<Node<"extend">>
  | kwNode<Node<"specialize">>
  | kwNode<Node<"from">>
  | Node<
      "ExternalSpecializeDeclaration",
      Array<
        | atNode<Node<"@external">>
        | kwNode<Node<"extend">>
        | kwNode<Node<"specialize">>
        | BodyNode
        | NameNode
        | kwNode<Node<"from">>
        | LiteralNode
        | externalTokenSetNode
      >
    >
  | atNode<Node<"@context">>
  | kwNode<Node<"from">>
  | Node<
      "ContextDeclaration",
      Array<
        atNode<Node<"@context">> | NameNode | kwNode<Node<"from">> | LiteralNode
      >
    >
  | atNode<Node<"@dialects">>
  | Node<"DialectBody", Array<Node<"{"> | NameNode | Node<","> | Node<"}">>>
  | Node<
      "DialectsDeclaration",
      Array<
        | atNode<Node<"@dialects">>
        | Node<
            "DialectBody",
            Array<Node<"{"> | NameNode | Node<","> | Node<"}">>
          >
      >
    >
  | atNode<Node<"@skip">>
  | Node<"TopSkipDeclaration", Array<atNode<Node<"@skip">> | BodyNode>>
  | atNode<Node<"@skip">>
  | Node<
      "SkipBody",
      Array<
        Node<"{"> | RuleDeclarationNode | topRuleDeclarationNode | Node<"}">
      >
    >
  | Node<
      "SkipScope",
      Array<
        | atNode<Node<"@skip">>
        | BodyNode
        | Node<
            "SkipBody",
            Array<
              | Node<"{">
              | RuleDeclarationNode
              | topRuleDeclarationNode
              | Node<"}">
            >
          >
      >
    >
  | atNode<Node<"@detectDelim">>
  | Node<"DetectDelimDeclaration", Array<atNode<Node<"@detectDelim">>>>
  | declarationNode
  | Node<"Token", Array<RuleNameNode | PropsNode>>
  | externalTokenSetNode
  | atNode<Node<"@precedence">>
  | Node<
      "PrecedenceBody",
      Array<
        Node<"{"> | LiteralNode | nameExpressionNode | Node<","> | Node<"}">
      >
    >
  | Node<
      "TokenPrecedenceDeclaration",
      Array<
        | atNode<Node<"@precedence">>
        | Node<
            "PrecedenceBody",
            Array<
              | Node<"{">
              | LiteralNode
              | nameExpressionNode
              | Node<",">
              | Node<"}">
            >
          >
      >
    >
  | atNode<Node<"@conflict">>
  | Node<
      "ConflictBody",
      Array<
        | Node<"{">
        | LiteralNode
        | nameExpressionNode
        | Node<",">
        | LiteralNode
        | nameExpressionNode
        | Node<"}">
      >
    >
  | Node<
      "TokenConflictDeclaration",
      Array<
        | atNode<Node<"@conflict">>
        | Node<
            "ConflictBody",
            Array<
              | Node<"{">
              | LiteralNode
              | nameExpressionNode
              | Node<",">
              | LiteralNode
              | nameExpressionNode
              | Node<"}">
            >
          >
      >
    >
  | Node<"LiteralTokenDeclaration", Array<LiteralNode | PropsNode>>
  | tokenDeclarationNode
  | RuleDeclarationNode
  | atNode<Node<"@top">>
  | topRuleDeclarationNode
  | ParamListNode
  | BodyNode
  | PropsNode
  | Node<"PropEsc", Array<Node<"{"> | RuleNameNode | Node<"}">>>
  | PropNode
  | Node<"Choice", Array<seqExpressionNode | Node<"|"> | seqExpressionNode>>
  | expressionNode
  | Node<
      "Sequence",
      Array<
        | markerNode
        | atomExpressionNode
        | markerNode
        | atomExpressionNode
        | atomExpressionNode
        | markerNode
      >
    >
  | seqExpressionNode
  | Node<"CharClass">
  | Node<"Optional", Array<atomExpressionNode | Node<"?">>>
  | Node<"Repeat", Array<atomExpressionNode | Node<"*">>>
  | Node<"Repeat1", Array<atomExpressionNode | Node<"+">>>
  | Node<"InlineRule", Array<RuleNameNode | PropsNode | PropsNode | BodyNode>>
  | Node<"ParenExpression", Array<Node<"("> | expressionNode | Node<")">>>
  | atNode<Node<"@specialize">>
  | atNode<Node<"@extend">>
  | Node<
      "Specialization",
      Array<
        | atNode<Node<"@specialize">>
        | atNode<Node<"@extend">>
        | PropsNode
        | ArgListNode
      >
    >
  | atomExpressionNode
  | Node<"Call", Array<RuleNameNode | ScopedNameNode | ArgListNode>>
  | nameExpressionNode
  | Node<"PrecedenceMarker", Array<Node<"!"> | PrecedenceNameNode>>
  | Node<"AmbiguityMarker", Array<Node<"~"> | NameNode>>
  | markerNode
  | ScopedNameNode
  | ArgListNode
  | RuleNameNode
  | PrecedenceNameNode
  | Node<"a", Array<nameNode>>
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
