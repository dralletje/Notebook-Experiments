import { prettyPrint } from "recast";
import * as t from "@babel/types";
import { without } from "lodash-es";

import { traverse, get_scope } from "./babel-helpers.js";

// let t = builders;

let RESULT_PLACEHOLDER = t.identifier("__RESULT_PLACEHOLDER__");

let get_has_top_level_return = (ast) => {
  let has_top_level_return = false;
  traverse(ast, {
    ReturnStatement(path) {
      // Check if this statement is inside a function
      let parent_function = path.getFunctionParent();
      if (parent_function) {
        // If it is, good
      } else {
        has_top_level_return = true;
      }
    },
  });
  return has_top_level_return;
};

/**
 * @param {import("./babel-helpers").AST} ast
 * @param {string[]} created_names
 */
let fix_return_and_get_result_ast = (ast, created_names) => {
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
      if (statement.type === "ClassDeclaration") {
        result_ast = t.classDeclaration(
          statement.id,
          statement.superClass,
          t.classBody([t.classProperty(RESULT_PLACEHOLDER, null)])
        );
        // Would love to send something back, but it would just show `f()`
        // so my `result_ast` is cooler in every way for now
        // (We can get the static and prototype keys later with Object.getOwnPropertyNames)
        return [statement, return_with_default(statement.id)];
      } else if (statement.type === "FunctionDeclaration") {
        console.log(`statement:`, statement);
        result_ast = t.functionDeclaration(
          statement.id,
          statement.params,
          t.blockStatement([]),
          // t.blockStatement([t.expressionStatement(RESULT_PLACEHOLDER)]),
          statement.generator,
          statement.async
        );
        return [statement, return_with_default(statement.id)];
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
        result_ast = t.variableDeclaration(statement.kind, [
          t.variableDeclarator(left_hand_side, RESULT_PLACEHOLDER),
        ]);
        return [statement, return_with_default(left_hand_side)];
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
                  if (specifier.type === "ExportSpecifier") {
                    return t.objectProperty(
                      specifier.exported,
                      specifier.local
                    );
                  } else {
                    // TODO Not sure what to do here
                    return t.objectProperty(
                      specifier.exported,
                      t.identifier("undefined")
                    );
                  }
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
        return [
          statement,
          return_with_default(
            t.newExpression(t.identifier("Error"), [
              t.stringLiteral(
                `Couldn't 'return-ify' "${statement.type}" statement`
              ),
            ])
          ),
        ];
      }
    }
    return statement;
  });
};

/** @param {import("./babel-helpers").AST} ast */
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
  let has_top_level_return = get_has_top_level_return(ast);

  let result_ast = fix_return_and_get_result_ast(ast, created_names);

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
                return t.restElement(t.identifier(specifier.local.name));
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
    // Change `import.meta.X` to `__meta__.X`
    MetaProperty(path) {
      path.replaceWith(t.identifier("__meta__"));
    },
    // Remove `export ...` statements (or rather, get rid of the export part)
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        path.replaceWith(path.node.declaration);
      }
    },
    // Change `import("x")` to `__meta__.import("x")`
    Import(path) {
      path.replaceWith(
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
    meta: {
      has_top_level_return: has_top_level_return,
      created_names,
      consumed_names,
      last_created_name:
        result_ast != null
          ? remove_semicolon(prettyPrint(result_ast).code).replaceAll(
              /\n */g,
              " "
            )
          : null,
    },
  };
}

let remove_semicolon = (code) => {
  return code.replace(/;$/, "");
};
