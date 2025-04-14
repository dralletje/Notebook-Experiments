// import { prettyPrint } from "recast";
// import * as t from "@babel/types";
import { compact, without } from "lodash-es";
import type * as Ast from "@swc/wasm-web";
import { parseSync } from "../swc";

// let l = parseSync("let x = 10");
// console.log(`l:`, l);
// // @ts-ignore
// let span = (l.body[0] as Ast.ExpressionStatement).expression.span;

// console.log(
//   `(l.body[0] as Ast.ExpressionStatement).expression:`,
//   (l.body[0] as Ast.ExpressionStatement).expression
// );

// import { traverse, get_scope } from "./babel-helpers.js";
let NOSPAN: Ast.Span = { ctxt: 0, start: 0, end: 0 };
// let NOSPAN: Ast.Span = span;
// console.log(`span:`, span);
// let NOSPAN: Ast.Span = null as any ;

let RESULT_PLACEHOLDER: Ast.Identifier = {
  type: "Identifier",
  value: "__RESULT_PLACEHOLDER__",
  optional: false,
  span: NOSPAN,
};

class Path<T extends Ast.Node> {
  parent: Path<any> | null;
  node: T;
  key: string | [string, number] | null;

  constructor(
    node: T,
    parent: Path<any> | null = null,
    key: string | [string, number] | null = null
  ) {
    this.parent = parent;
    this.node = node;
    this.key = key;
  }
  // getFunctionParent() {
  //   // TODO
  //   return null;
  // }
  replaceWith(node: Ast.Node) {
    if (this.key == null || this.parent == null) {
      throw new Error("No parent");
    } else if (typeof this.key === "string") {
      this.parent.node[this.key] = node;
    } else {
      this.parent.node[this.key[0]][this.key[1]] = node;
    }
  }
}

let t = {
  identifier: (name: string): Ast.Identifier => {
    return {
      type: "Identifier",
      value: name,
      optional: false,
      span: NOSPAN,
      // @ts-ignore
      ctxt: 0,
    };
  },
  memberExpression: (
    object: Ast.Expression,
    property: Ast.Identifier
  ): Ast.MemberExpression => {
    return {
      type: "MemberExpression",
      object,
      property,
      span: NOSPAN,
    };
  },
  objectExpression: (
    properties: Array<Ast.Property | Ast.SpreadElement>
  ): Ast.ObjectExpression => {
    return {
      type: "ObjectExpression",
      properties,
      span: NOSPAN,
    };
  },
  objectProperty: (
    key: Ast.Identifier,
    value: Ast.Expression
  ): Ast.Property => {
    return {
      type: "KeyValueProperty",
      key: key,
      value: value,
      // @ts-ignore
      span: NOSPAN,
    };
  },
  variableDeclaration: (
    kind: Ast.VariableDeclarationKind,
    declarations: Array<Ast.VariableDeclarator>
  ): Ast.VariableDeclaration => {
    return {
      type: "VariableDeclaration",
      kind: kind,
      declare: false,
      declarations: declarations,
      span: NOSPAN,
      // @ts-ignore
      ctxt: 0,
    };
  },
  variableDeclarator: (
    id: Ast.Pattern,
    init: Ast.Expression | null
  ): Ast.VariableDeclarator => {
    return {
      type: "VariableDeclarator",
      id: id,
      init: init ?? undefined,
      definite: false,
      span: NOSPAN,
      // @ts-ignore
      ctxt: 0,
    };
  },
  functionDeclaration: (
    id: Ast.Identifier,
    params: Array<Ast.Param>,
    body: Ast.BlockStatement,
    generator: boolean,
    async: boolean
  ): Ast.FunctionDeclaration => {
    return {
      type: "FunctionDeclaration",
      identifier: id,
      declare: false,
      decorators: [],
      params: params,
      body: body,
      generator: generator,
      async: async,
      returnType: undefined,
      typeParameters: undefined,
      span: NOSPAN,
    };
  },
  returnStatement: (argument: Ast.Expression): Ast.ReturnStatement => {
    return {
      type: "ReturnStatement",
      argument: argument,
      span: NOSPAN,
    };
  },
  objectPattern: (
    properties: Array<Ast.ObjectPatternProperty>
  ): Ast.ObjectPattern => {
    return {
      type: "ObjectPattern",
      optional: false,
      properties,
      span: NOSPAN,
    };
  },
  keyValuePatternProperty: (
    key: Ast.PropertyName,
    value: Ast.Pattern
  ): Ast.KeyValuePatternProperty => {
    return {
      type: "KeyValuePatternProperty",
      key,
      value,
      // kind: "init",
      // method: false,
      // shorthand: false,
      // decorators: [],
      // span: NOSPAN,
    };
  },
  awaitExpression: (argument: Ast.Expression): Ast.AwaitExpression => {
    return {
      type: "AwaitExpression",
      argument,
      span: NOSPAN,
    };
  },
  restElement: (argument: Ast.Pattern): Ast.RestElement => {
    return {
      type: "RestElement",
      rest: NOSPAN,
      argument,
      span: NOSPAN,
    };
  },
  import: (): Ast.Import => {
    return {
      type: "Import",
      span: NOSPAN,
      // @ts-ignore
      phase: "evaluation",
    };
  },
  callExpression: (
    callee: Ast.Expression | Ast.Import | Ast.Super,
    _arguments: Array<Ast.Argument>
  ): Ast.CallExpression => {
    return {
      type: "CallExpression",
      callee,
      arguments: _arguments,
      span: NOSPAN,
      // @ts-ignore
      ctxt: 0,
    };
  },
  arrayExpression: (elements: Array<Ast.ExprOrSpread>): Ast.ArrayExpression => {
    return {
      type: "ArrayExpression",
      elements,
      span: NOSPAN,
    };
  },
  argument: (name: Ast.Expression): Ast.Argument => {
    console.log(`name:`, name);
    return {
      spread: undefined,
      expression: name,
    };
  },
  stringLiteral: (value: string): Ast.StringLiteral => {
    return {
      type: "StringLiteral",
      value,
      span: NOSPAN,
    };
  },
  functionExpression: (
    id: Ast.Identifier | null,
    async: boolean,
    params: Array<Ast.Param>,
    body: Ast.BlockStatement
  ): Ast.FunctionExpression => {
    return {
      async: async,
      type: "FunctionExpression",
      params,
      body,
      generator: false,
      identifier: id ?? undefined,
      returnType: undefined,
      typeParameters: undefined,
      span: NOSPAN,

      // @ts-ignore
      ctxt: 0,
    };
  },
  blockStatement: (body: Array<Ast.Statement>): Ast.BlockStatement => {
    return {
      type: "BlockStatement",
      stmts: body,
      span: NOSPAN,

      // @ts-ignore
      ctxt: 0,
    };
  },
  expressionStatement: (
    expression: Ast.Expression
  ): Ast.ExpressionStatement => {
    return {
      type: "ExpressionStatement",
      expression,
      span: NOSPAN,
    };
  },
};

let traverse_path = (
  path: Path<any>,
  visitors: { [key: string]: (path: Path<any>) => Node | void }
) => {
  for (let [key, value] of Object.entries(path.node)) {
    if (Array.isArray(value)) {
      for (let [index, node] of value.entries()) {
        if (typeof node?.type === "string") {
          let visitor = visitors[node.type];
          let childpath = new Path(node, path, [key, index]);
          traverse_path(childpath, visitors);
          if (visitor) {
            visitor(childpath);
          }
        }
      }
    } else if (typeof value === "object" && value != null && "type" in value) {
      if (typeof value.type === "string") {
        let visitor = visitors[value.type];
        let childpath = new Path(value as any, path, key);
        traverse_path(childpath, visitors);
        if (visitor) {
          visitor(childpath);
        }
      }
    }
  }
};

let traverse = (
  node: Ast.Node,
  visitors: { [key: string]: (path: Path<any>) => Node | void }
) => {
  traverse_path(new Path(node), visitors);
};

// let get_has_top_level_return = (ast: Ast.Module) => {
//   let has_top_level_return = false;
//   traverse(ast, {
//     ReturnStatement(path) {
//       // Check if this statement is inside a function
//       let parent_function = path.getFunctionParent();
//       if (parent_function) {
//         // If it is, good
//       } else {
//         has_top_level_return = true;
//       }
//     },
//   });
//   return has_top_level_return;
// };

/**
 * @param {import("@babel/types").File} ast
 * @param {import("@babel/types").ObjectProperty[]} properties_to_return
 */
// let fix_return_and_get_result_ast = (ast, properties_to_return) => {
//   let return_with_default = (_default) => {
//     return t.returnStatement(
//       t.objectExpression([
//         t.objectProperty(t.identifier("default"), _default),
//         ...properties_to_return,
//       ])
//     );
//   };

//   if (ast.program.body.length === 0) {
//     ast.program.body.push(return_with_default(t.identifier("undefined")));
//     return null;
//   }

//   let result_ast = null;
//   ast.program.body = ast.program.body.flatMap((statement, index) => {
//     if (index === ast.program.body.length - 1) {
//       if (statement.type === "ClassDeclaration") {
//         result_ast = t.classDeclaration(
//           statement.id,
//           statement.superClass,
//           t.classBody([t.classProperty(RESULT_PLACEHOLDER, null)])
//         );
//         // Would love to send something back, but it would just show `f()`
//         // so my `result_ast` is cooler in every way for now
//         // (We can get the static and prototype keys later with Object.getOwnPropertyNames)
//         return [statement, return_with_default(statement.id)];
//       } else if (statement.type === "FunctionDeclaration") {
//         result_ast = t.functionDeclaration(
//           statement.id,
//           statement.params,
//           t.blockStatement([]),
//           // t.blockStatement([t.expressionStatement(RESULT_PLACEHOLDER)]),
//           statement.generator,
//           statement.async
//         );
//         return [statement, return_with_default(statement.id)];
//       } else if (statement.type === "ExpressionStatement") {
//         if (
//           statement.expression.type === "AssignmentExpression" &&
//           statement.expression.left.type === "Identifier"
//         ) {
//           result_ast = t.assignmentExpression(
//             "=",
//             t.identifier(statement.expression.left.name),
//             RESULT_PLACEHOLDER
//           );
//           return [
//             statement,
//             return_with_default(t.identifier(statement.expression.left.name)),
//           ];
//         } else {
//           return return_with_default(statement.expression);
//         }
//       } else if (
//         statement.type === "VariableDeclaration" &&
//         statement.declarations.length === 1
//       ) {
//         let left_hand_side = statement.declarations[0].id;
//         result_ast = t.variableDeclaration(statement.kind, [
//           t.variableDeclarator(left_hand_side, RESULT_PLACEHOLDER),
//         ]);
//         return [statement, return_with_default(left_hand_side)];
//       } else if (statement.type === "ExportNamedDeclaration") {
//         if (statement.declaration == null) {
//           // Because typescript will replace type exports/imports with `export {}` (to be a module)
//           // I'm not going to show these at all, even if you really want to 😈
//           if (statement.specifiers.length === 0) {
//             return [return_with_default(t.identifier("undefined"))];
//           }

//           // export { a, b, c }
//           result_ast = t.exportNamedDeclaration(null, [
//             {
//               type: "ExportSpecifier",
//               exported: RESULT_PLACEHOLDER,
//               local: RESULT_PLACEHOLDER,
//             },
//           ]);
//           return [
//             return_with_default(
//               t.objectExpression(
//                 statement.specifiers.map((specifier) => {
//                   if (specifier.type === "ExportSpecifier") {
//                     return t.objectProperty(
//                       specifier.exported,
//                       specifier.local
//                     );
//                   } else {
//                     // TODO Not sure what to do here
//                     return t.objectProperty(
//                       specifier.exported,
//                       t.identifier("undefined")
//                     );
//                   }
//                 })
//               )
//             ),
//           ];
//         } else {
//           // export let x = 10
//           if (statement.declaration.type === "VariableDeclaration") {
//             if (statement.declaration.declarations.length === 1) {
//               result_ast = t.exportNamedDeclaration(
//                 t.variableDeclaration(statement.declaration.kind, [
//                   t.variableDeclarator(
//                     statement.declaration.declarations[0].id,
//                     RESULT_PLACEHOLDER
//                   ),
//                 ])
//               );
//               return [
//                 statement,
//                 return_with_default(statement.declaration.declarations[0].id),
//               ];
//             } else {
//               // export let x = 10, y = 20
//               // :(
//               return [
//                 statement,
//                 return_with_default(t.identifier("undefined")),
//               ];
//             }
//           }
//         }
//       } else if (statement.type === "ImportDeclaration") {
//         let { source, specifiers } = statement;

//         if (specifiers.length === 0) {
//           result_ast = t.importDeclaration([], statement.source);
//           return [statement];
//         } else {
//           result_ast = t.importDeclaration(
//             [t.importDefaultSpecifier(RESULT_PLACEHOLDER)],
//             statement.source
//           );
//           return [
//             statement,
//             return_with_default(
//               t.objectExpression(
//                 specifiers.map((specifier) => {
//                   if (specifier.type === "ImportDefaultSpecifier") {
//                     return t.objectProperty(
//                       t.identifier(specifier.local.name),
//                       t.identifier(specifier.local.name)
//                     );
//                   } else if (specifier.type === "ImportNamespaceSpecifier") {
//                     return t.objectProperty(specifier.local, specifier.local);
//                   } else {
//                     return t.objectProperty(specifier.local, specifier.local);
//                   }
//                 })
//               )
//             ),
//           ];
//         }
//       } else {
//         return [
//           statement,
//           return_with_default(
//             t.newExpression(t.identifier("SyntaxError"), [
//               t.stringLiteral(
//                 `Couldn't 'return-ify' "${statement.type}" statement`
//               ),
//             ])
//           ),
//         ];
//       }
//     }
//     return statement;
//   });

//   return result_ast;
// };

let to_string = (ast: Ast.Identifier | Ast.ModuleExportName) => {
  if (ast.type === "Identifier") {
    return ast.value;
  } else if (ast.type === "StringLiteral") {
    return ast.value;
  } else {
    // @ts-expect-error
    throw new Error(`AAAAaa ${ast.type}`);
  }
};

let has_async = (ast) => {
  let has_async = false;
  traverse(ast, {
    AwaitExpression({ node }: Path<Ast.AwaitExpression>) {
      has_async = true;
    },
  });
  return has_async;
};

let get_exported = (ast: Ast.Module): { [exported_as: string]: string } => {
  let exported: { [exported_as: string]: string } = {};
  traverse(ast, {
    ExportDeclaration({ node }: Path<Ast.ExportDeclaration>) {
      // if (node.declaration != null) {
      //   // export let x = 10
      //   if (node.declaration.type === "VariableDeclaration") {
      //     for (let declaration of node.declaration.declarations) {
      //       exported[to_string(declaration.id)] = to_string(declaration.id);
      //     }
      //   } else {
      //     throw new Error(
      //       `Expected a VariableDeclaration but got a "${node.declaration.type}"`
      //     );
      //   }
      // }

      if (node.declaration.type === "VariableDeclaration") {
        for (let declaration of node.declaration.declarations) {
          if (declaration.id.type === "Identifier") {
            exported[to_string(declaration.id)] = to_string(declaration.id);
          } else {
            // prettier-ignore
            throw new Error(`Expected an Identifier but got a "${declaration.id.type}"`);
          }
        }
      } else {
        // prettier-ignore
        throw new Error(`Expected a VariableDeclaration but got a "${node.declaration.type}"`);
      }
    },
    ExportNamedDeclaration({ node }: Path<Ast.ExportNamedDeclaration>) {
      // prettier-ignore
      throw new Error("Not implemented: Need to rewrite default exports to first a variable, then export that...");
    },
    ExportDefaultDeclaration({ node }: Path<Ast.ExportDefaultDeclaration>) {
      // prettier-ignore
      throw new Error("Not implemented: Need to rewrite default exports to first a variable, then export that...");
    },
  });
  return exported;
};

export function transform(ast: Ast.Module) {
  // for (let directive of ast.program.directives) {
  //   ast.program.body.unshift(
  //     t.expressionStatement(t.stringLiteral(directive.value.value))
  //   );
  // }

  // Add "use strict" directive
  ast.body.unshift({
    type: "ExpressionStatement",
    span: NOSPAN,
    expression: {
      type: "StringLiteral",
      value: "use strict",
      span: NOSPAN,
    },
  });

  // ast.program.directives = [t.directive(t.directiveLiteral("use strict"))];

  // let accidental_globals = [];
  // for (let statement of ast.program.body) {
  //   if (statement.type === "ExpressionStatement") {
  //     if (statement.expression.type === "AssignmentExpression") {
  //       // TODO Work for all patterns
  //       if (statement.expression.left.type === "Identifier") {
  //         accidental_globals.push(statement.expression.left.name);
  //       }
  //     }
  //   }
  // }
  // // Prepend variable declaration to the top of the program
  // if (accidental_globals.length > 0) {
  //   ast.program.body.unshift(
  //     t.variableDeclaration(
  //       "let",
  //       accidental_globals.map((name) =>
  //         t.variableDeclarator(t.identifier(name), null)
  //       )
  //     )
  //   );
  // }

  // let scope = get_scope(ast);
  // // TODO scope.getAllBindings?
  // let created_names = [...Object.keys(scope.bindings), ...accidental_globals];
  // let consumed_names = without(
  //   // @ts-ignore
  //   Object.keys(scope.globals),
  //   ...accidental_globals
  // );
  // let has_top_level_return = get_has_top_level_return(ast);
  let exported = get_exported(ast);

  console.log(`exported:`, exported);

  // let result_ast = fix_return_and_get_result_ast(ast, [
  //   ...created_names.map((name) => {
  //     return t.objectProperty(t.identifier(name), t.identifier(name));
  //   }),
  //   t.objectProperty(
  //     // Can use normal prohibited names because they'll never be variable names
  //     // (TODO Should also just put created_names in a separate property...)
  //     t.identifier("export"),
  //     t.objectExpression(
  //       Object.entries(exported).map(([exported_as, local_name]) => {
  //         return t.objectProperty(
  //           t.identifier(exported_as),
  //           t.identifier(local_name)
  //         );
  //       })
  //     )
  //   ),
  // ]);

  // Transform `import X from "X"` to `const X = import("X")`
  ast.body = ast.body.map((statement) => {
    if (statement.type === "ImportDeclaration") {
      let { source, specifiers } = statement;

      let requested_variables = compact(
        specifiers.map((specifier) => {
          if (specifier.type === "ImportDefaultSpecifier") {
            return "default";
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            // Eh
            throw new Error(
              `Expected an ImportSpecifier but got a "${specifier.type}"`
            );
          } else if (specifier.type === "ImportSpecifier") {
            let name = specifier.imported ?? specifier.local;
            return to_string(name);
          } else {
            // prettier-ignore
            // @ts-expect-error
            throw new Error(`Expected an ImportSpecifier but got a "${specifier.type}"`);
          }
        })
      );

      return t.variableDeclaration("const", [
        t.variableDeclarator(
          t.objectPattern(
            specifiers.map((specifier) => {
              // return t.keyValuePatternProperty(t.identifier(specifier.local.value), t.identifier(specifier.local.value));
              if (specifier.type === "ImportDefaultSpecifier") {
                // import X from "X"
                return t.keyValuePatternProperty(
                  t.identifier("default"),
                  t.identifier(specifier.local.value)
                );
                // } else if (specifier.type === "ImportNamespaceSpecifier") {
                //   // import * as X from "X"
                //   return t.restElement(t.identifier(specifier.local.value));
              } else if (specifier.type === "ImportSpecifier") {
                // import { X } from "X"
                return t.keyValuePatternProperty(
                  specifier.imported ?? specifier.local,
                  specifier.local
                );
              } else {
                throw new Error("Unknown specifier type");
              }
            })
          ),
          t.awaitExpression(
            t.callExpression(t.import(), [
              t.argument(source),

              // // Also provide the requested variables so we can error when they aren't there
              t.argument(
                t.arrayExpression(
                  requested_variables.map((x) => ({
                    expression: t.stringLiteral(x),
                  }))
                )
              ),
            ])
          )
        ),
      ]);
    } else {
      return statement;
    }
  });

  ast.body.push(
    t.returnStatement(
      t.objectExpression([
        t.objectProperty(
          // Can use normal prohibited names because they'll never be variable names
          // (TODO Should also just put created_names in a separate property...)
          t.identifier("export"),
          t.objectExpression(
            Object.entries(exported).map(([exported_as, local_name]) => {
              return t.objectProperty(
                t.identifier(exported_as),
                t.identifier(local_name)
              );
            })
          )
        ),
      ])
    )
  );

  traverse(ast, {
    // Change `import.meta.X` to `__meta__.X`
    MetaProperty(path: Path<Ast.MetaProperty>) {
      path.replaceWith(t.identifier("__meta__"));
    },
    // Remove `export ...` statements (or rather, get rid of the export part)
    ExportDeclaration(path) {
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

  ast.body = has_async(ast) ? [wrap_in_async_function(ast.body)] : ast.body;

  let created_names = [];
  let consumed_names = [];
  let has_top_level_return = false;

  return {
    ast: ast,
    meta: {
      has_top_level_return: has_top_level_return,
      created_names,
      consumed_names,
      // last_created_name:
      //   result_ast != null
      //     ? remove_semicolon(prettyPrint(result_ast).code).replaceAll(
      //         /\n */g,
      //         " "
      //       )
      //     : null,
    },
  };
}

let remove_semicolon = (code) => {
  return code.replace(/;$/, "");
};

let wrap_in_async_function = (body) => {
  // Wrap the whole thing in an async function like
  // return (async () => { ... })()
  let func = t.functionExpression(
    t.identifier("ConstructedFunction"),
    true,
    [],
    t.blockStatement(body)
  );
  return t.returnStatement(t.callExpression(func, []));
};
