import { parse, print, types, prettyPrint } from "recast";
import { builders, Type } from "ast-types";
import { parse as parseBabel } from "@babel/parser";
import traverse1, { NodePath } from "@babel/traverse";
import { compact, without } from "lodash-es";
import { transformSync } from "@babel/core";
import preset from "@babel/preset-typescript";

let t = builders;
/** @type {typeof traverse1} */
let traverse = /** @type {any} */ (traverse1).default ?? traverse1;

let get_scope = (ast) => {
  /** @type {NodePath<any>} */
  let program_path = /** @type {any} */ (null);
  traverse(ast, {
    Program(path) {
      program_path = path;
    },
  });
  let scope = program_path.scope;
  return scope;
};

let btoa = (string) => {
  let buff = Buffer.from(string);
  return buff.toString("base64");
};

/**
 * @param {string} code
 * @param {{ filename: string }} options
 */
export function transform_code(code, { filename }) {
  let without_typescript = transformSync(code, {
    filename: "file.ts",
    parserOpts: {
      allowUndeclaredExports: true,
    },
    presets: [[preset, { onlyRemoveTypeImports: true }]],
  });
  /** @type {string} */
  let without_typescript_code = /** @type {any} */ (without_typescript?.code);

  // /** @type {ReturnType<parseBabel>} */
  const unmodified_ast = parse(without_typescript_code, {
    parser: {
      parse: (input, options) => {
        return parseBabel(input, {
          ...options,
          plugins: ["typescript", "jsx"],
          allowUndeclaredExports: true,
        });
      },
    },
    // tabWidth: 0,
    sourceFileName: filename,
  });

  let { ast, consumed_names, created_names, last_created_name } =
    transform(unmodified_ast);

  // TODO Want to use print() here, but it screws up template strings:
  // .... `
  // .... hi
  // .... `
  // .... becomes
  // ....     `
  // ....     hi
  // ....     `
  // .... which is very wrong
  let result = prettyPrint(ast, {
    tabWidth: 0,
    sourceMapName: "map.json",
  });

  // let source_map = "data:text/plain;base64," + btoa(JSON.stringify(result.map));
  // let full_code = `${result.code}\n//# sourceMappingURL=${source_map}\n//# sourceURL=${filename}`;
  let full_code = result.code;
  return {
    map: result.map,
    code: full_code,
    created_names,
    consumed_names,
    last_created_name,
  };
}

let RESULT_PLACEHOLDER = t.identifier("__RESULT_PLACEHOLDER__");

export function transform(ast) {
  for (let directive of ast.program.directives) {
    ast.program.body.unshift(
      t.expressionStatement(t.stringLiteral(directive.value.value))
    );
  }
  // Add "use strict" directive
  ast.program.directives = [t.directive(t.directiveLiteral("use strict"))];

  let accidental_globals = [];
  for (let statement of ast.program.body) {
    if (statement.type === "ExpressionStatement") {
      if (statement.expression.type === "AssignmentExpression") {
        // TODO Work for all patterns
        if (statement.expression.left.type === "Identifier") {
          accidental_globals.push(statement.expression.left.name);
        }
      }
    }
  }
  // Prepend variable declaration to the top of the program
  if (accidental_globals.length > 0) {
    ast.program.body.unshift(
      t.variableDeclaration(
        "let",
        accidental_globals.map((name) =>
          t.variableDeclarator(t.identifier(name), null)
        )
      )
    );
  }

  let scope = get_scope(ast);
  // TODO scope.getAllBindings?
  let created_names = [...Object.keys(scope.bindings), ...accidental_globals];
  let consumed_names = without(
    // @ts-ignore
    Object.keys(scope.globals),
    ...accidental_globals
  );

  let properties_to_return = created_names.map((name) => {
    return t.objectProperty(t.identifier(name), t.identifier(name));
  });

  let return_with_default = (_default) => {
    return t.returnStatement(
      t.objectExpression([
        t.objectProperty(t.identifier("default"), _default),
        ...properties_to_return,
      ])
    );
  };

  let result_ast = null;
  ast.program.body = ast.program.body.flatMap((statement, index) => {
    if (index === ast.program.body.length - 1) {
      if (statement.type === "FunctionDeclaration") {
        result_ast = t.assignmentExpression(
          "=",
          t.identifier(statement.id.name),
          RESULT_PLACEHOLDER
        );
        return [
          statement,
          return_with_default(t.identifier(statement.id.name)),
        ];
      } else if (statement.type === "ExpressionStatement") {
        if (
          statement.expression.type === "AssignmentExpression" &&
          statement.expression.left.type === "Identifier"
        ) {
          result_ast = t.assignmentExpression(
            "=",
            t.identifier(statement.expression.left.name),
            RESULT_PLACEHOLDER
          );
          return [
            statement,
            return_with_default(t.identifier(statement.expression.left.name)),
          ];
        } else {
          return return_with_default(statement.expression);
        }
      } else if (
        statement.type === "VariableDeclaration" &&
        statement.declarations.length === 1
      ) {
        let left_hand_side = statement.declarations[0].id;

        if (left_hand_side.type === "Identifier") {
          result_ast = t.variableDeclaration(statement.kind, [
            t.variableDeclarator(
              t.identifier(left_hand_side.name),
              RESULT_PLACEHOLDER
            ),
          ]);
          return [
            statement,
            return_with_default(
              t.identifier(statement.declarations[0].id.name)
            ),
          ];
        } else {
          // TODO For the code `let { a: new_a } = c`, this will return `{ a: new_a }`,
          // .... but I want to return `{ new_a: new_a }` (the original name is irrelevant)
          return [statement, return_with_default(left_hand_side)];
        }
      } else if (statement.type === "ExportNamedDeclaration") {
        if (statement.declaration == null) {
          // export { a, b, c }
          result_ast = t.exportNamedDeclaration(null, [
            {
              type: "ExportSpecifier",
              exported: RESULT_PLACEHOLDER,
              local: RESULT_PLACEHOLDER,
            },
          ]);
          return [
            return_with_default(
              t.objectExpression(
                statement.specifiers.map((specifier) => {
                  return t.objectProperty(specifier.exported, specifier.local);
                })
              )
            ),
          ];
        } else {
          // export let x = 10
          if (statement.declaration.type === "VariableDeclaration") {
            if (statement.declaration.declarations.length === 1) {
              result_ast = t.exportNamedDeclaration(
                t.variableDeclaration(statement.declaration.kind, [
                  t.variableDeclarator(
                    statement.declaration.declarations[0].id,
                    RESULT_PLACEHOLDER
                  ),
                ])
              );
              return [
                statement,
                return_with_default(statement.declaration.declarations[0].id),
              ];
            } else {
              // export let x = 10, y = 20
              // :(
              return [
                statement,
                return_with_default(t.identifier("undefined")),
              ];
            }
          }
        }
      } else if (statement.type === "ImportDeclaration") {
        let { source, specifiers } = statement;

        if (specifiers.length === 0) {
          result_ast = t.importDeclaration([], statement.source);
          return [statement];
        } else {
          result_ast = t.importDeclaration(
            [t.importDefaultSpecifier(RESULT_PLACEHOLDER)],
            statement.source
          );
          return [
            statement,
            return_with_default(
              t.objectExpression(
                specifiers.map((specifier) => {
                  if (specifier.type === "ImportDefaultSpecifier") {
                    return t.objectProperty(
                      t.identifier(specifier.local.name),
                      t.identifier(specifier.local.name)
                    );
                  } else if (specifier.type === "ImportNamespaceSpecifier") {
                    return t.objectProperty(specifier.local, specifier.local);
                  } else {
                    return t.objectProperty(specifier.local, specifier.local);
                  }
                })
              )
            ),
          ];
        }
      } else {
        throw new Error(`Couldn't 'return-ify' "${print(statement).code}"`);
      }
    }
    return statement;
  });

  // Transform `import X from "X"` to `const X = import("X")`
  ast.program.body = ast.program.body.map((statement) => {
    if (statement.type === "ImportDeclaration") {
      let { source, specifiers } = statement;
      return t.variableDeclaration("const", [
        t.variableDeclarator(
          t.objectPattern(
            specifiers.map((specifier) => {
              if (specifier.type === "ImportDefaultSpecifier") {
                return t.objectProperty(
                  t.identifier("default"),
                  t.identifier(specifier.local.name)
                );
              } else if (specifier.type === "ImportNamespaceSpecifier") {
                return t.restProperty(t.identifier(specifier.local.name));
              } else {
                return t.objectProperty(specifier.imported, specifier.local);
              }
            })
          ),
          t.awaitExpression(t.callExpression(t.import(), [source]))
        ),
      ]);
    } else {
      return statement;
    }
  });

  traverse(ast, {
    MetaProperty(path) {
      // @ts-ignore
      path.replaceWith(t.identifier("__meta__"));
    },
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        path.replaceWith(path.node.declaration);
      }
    },
    Import(path) {
      path.replaceWith(
        // @ts-ignore
        t.memberExpression(t.identifier("__meta__"), t.identifier("import"))
      );
    },
  });

  // Wrap the whole thing in an async function like
  // return (async () => { ... })()
  let func = t.functionExpression(null, [], t.blockStatement(ast.program.body));
  // Make function async
  func.async = true;
  ast.program.body = [t.returnStatement(t.callExpression(func, []))];
  return {
    ast: ast,
    created_names,
    consumed_names,
    last_created_name:
      result_ast != null
        ? remove_semicolon(prettyPrint(result_ast).code)
        : null,
  };
}

let remove_semicolon = (code) => {
  return code.replace(/;$/, "");
};
