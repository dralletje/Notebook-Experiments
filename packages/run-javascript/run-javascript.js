import { parse, print, types } from "recast";
import { builders, Type } from "ast-types";
import { parse as parseBabel } from "@babel/parser";
import traverse1, { NodePath } from "@babel/traverse";
import { compact, without } from "lodash-es";

let t = builders;
/** @type {typeof traverse1} */
let traverse = /** @type {any} */ (traverse1).default;

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
  // /** @type {ReturnType<parseBabel>} */
  const unmodified_ast = parse(code, {
    parser: { parse: parseBabel },
    // tabWidth: 0,
    sourceFileName: filename,
  });

  let { ast, consumed_names, created_names, last_created_name } =
    transform(unmodified_ast);

  let result = print(ast, {
    // tabWidth: 0,
    sourceMapName: "map.json",
  });

  let source_map = "data:text/plain;base64," + btoa(JSON.stringify(result.map));
  let full_code = `${result.code}\n//# sourceMappingURL=${source_map}\n//# sourceURL=${filename}`;
  // let full_code = `${result.code}\n//# sourceURL=${filename}`;
  return {
    map: result.map,
    code: full_code,
    created_names,
    consumed_names,
    last_created_name,
  };
}

export function transform(ast) {
  traverse(ast, {
    MetaProperty(path) {
      // @ts-ignore
      path.replaceWith(t.identifier("__meta__"));
    },
  });

  for (let directive of ast.program.directives) {
    ast.program.body.unshift(
      t.expressionStatement(t.stringLiteral(directive.value.value))
    );
  }
  // Add "use strict" directive
  ast.program.directives = [t.directive(t.directiveLiteral("use strict"))];

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

  let result_name = null;
  ast.program.body = ast.program.body.flatMap((statement, index) => {
    if (index === ast.program.body.length - 1) {
      if (statement.type === "ExpressionStatement") {
        if (statement.expression.type === "AssignmentExpression") {
          result_name = statement.expression.left.name;
          return [
            statement,
            t.returnStatement(
              t.objectExpression([
                t.objectProperty(
                  t.identifier("default"),
                  t.identifier(statement.expression.left.name)
                ),
                ...properties_to_return,
              ])
            ),
          ];
        } else {
          return t.returnStatement(
            t.objectExpression([
              t.objectProperty(t.identifier("default"), statement.expression),
              ...properties_to_return,
            ])
          );
        }
      } else if (
        statement.type === "VariableDeclaration" &&
        statement.declarations.length === 1
      ) {
        result_name = statement.declarations[0].id.name;
        return [
          statement,
          t.returnStatement(
            t.objectExpression([
              t.objectProperty(
                t.identifier("default"),
                statement.declarations[0].id
              ),
              ...properties_to_return,
            ])
          ),
        ];
      } else {
        console.log(`Couldn't 'return-ify'`, print(statement).code);
      }
    }
    return statement;
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
    last_created_name: result_name,
  };
}
