export let DEFAULT_TO_PARSE = `
Script(
  ExpressionStatement(
    CallExpression(
      VariableName,
      ArgList(
        "(",
        CallExpression(
          VariableName,
          ArgList(
            "(",
            VariableName,
            ",",
            CallExpression(
              VariableName,
              ArgList(
                "(",
                VariableName,
                ",",
                NewExpression(
                  new,
                  VariableName,
                  ArgList("(", ")")
                ),
                ",",
                NewExpression(
                  new,
                  VariableName,
                  ArgList("(", ")")
                ),
                ",",
                CallExpression(
                  VariableName,
                  ArgList(
                    "(",
                    VariableName,
                    ",",
                    NewExpression(
                      "new",
                      VariableName,
                      ArgList("(", ")")
                    ),
                    ")"
                  )
                ),
                ")"
              )
            ),
            ")"
          )
        ),
        ",",
        NewExpression(
          new,
          VariableName,
          ArgList("(", ")")
        ),
        ")"
      )
    )
  )
)
`.trim();

export let DEFAULT_PARSER_CODE = `
@top Program { node }

Fatal { "⚠" argument_list? }
argument_list { "(" node ("," node)* ")" }
node { Fatal | Node | String }
Node { Name argument_list? }

@skip { spaces | newline }

@tokens {
  Name { @asciiLetter+ }
  String { '"' (![\\\\\\n"] | "\\\\" _)* '"' }
  newline { $[\\r\\n] }
  spaces { " "+ }
}
`.trim();

export let DEFAULT_JAVASCRIPT_STUFF = `
import { styleTags, tags as t } from "@lezer/highlight";

export let tags = styleTags({
  Fatal: t.attributeName,
  String: t.string,
});
`.trim();
