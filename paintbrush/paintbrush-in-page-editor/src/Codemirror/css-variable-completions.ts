import { Completion, CompletionSource } from "@codemirror/autocomplete";
import { cssLanguage } from "@codemirror/lang-css";
import { syntaxTree } from "@codemirror/language";
import { EditorState, Facet, Text } from "@codemirror/state";
import { SyntaxNode } from "@lezer/common";

type CssVariable = { key: string; value: string };

export const css_variables_facet = Facet.define<CssVariable[], CssVariable[]>({
  combine: (values) => values.flat(),
});

function isVarArg(node: SyntaxNode, doc: Text) {
  if (node.name == "(" || node.type.isError) node = node.parent || node;
  if (node.name != "ArgList") return false;
  let callee = node.parent?.firstChild;
  if (callee?.name != "Callee") return false;
  return doc.sliceString(callee.from, callee.to) == "var";
}

let variable = /^-(-[\w-]*)?$/;

const css_variable_completions_source: CompletionSource = (context) => {
  let { state, pos } = context;
  let node = syntaxTree(state).resolveInner(pos, -1);
  let isDash =
    node.type.isError &&
    node.from == node.to - 1 &&
    state.doc.sliceString(node.from, node.to) == "-";

  if (
    node.name === "VariableName" ||
    ((context.explicit || isDash) && isVarArg(node, state.doc))
  ) {
    let variables = variableNames(state);
    console.log(`variables:`, variables);
    return {
      from: node.name === "VariableName" || isDash ? node.from : pos,
      options: variables,
      validFor: variable,
    };
  }
  return null;
};

let variableNames = (state: EditorState): Completion[] => {
  return state.facet(css_variables_facet).map((x) => {
    return {
      boost: 1, // Try putting it on top of the css-lang completions
      label: x.key,
      detail: x.value,
      type: "variable",
    };
  });
};

export let css_variable_completions = cssLanguage.data.of({
  autocomplete: css_variable_completions_source,
});
