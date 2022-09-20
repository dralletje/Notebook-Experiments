import { marked } from "marked";
// Ideally I'd lazy load the languages... but doesn't seem to work so mehh
import hl from "highlight.js";
// import hl from "highlight.js/es/core";

// I guess importing css works in modules with vite?
import "highlight.js/styles/github-dark-dimmed.css";
import "./md-literal.css";

/**
 * @param {() => Node} render
 * @param {() => Node} wrapper
 * @returns {(strings: TemplateStringsArray, ...parts: any[]) => Node}
 */
export function template(render, wrapper) {
  return function (strings) {
    var string = strings[0],
      parts = [],
      part,
      root = null,
      node,
      nodes,
      walker,
      i,
      n,
      j,
      m,
      k = -1;

    // Concatenate the text using comments as placeholders.
    for (i = 1, n = arguments.length; i < n; ++i) {
      part = arguments[i];
      if (part instanceof Node) {
        parts[++k] = part;
        string += "<!--o:" + k + "-->";
      } else if (Array.isArray(part)) {
        for (j = 0, m = part.length; j < m; ++j) {
          node = part[j];
          if (node instanceof Node) {
            if (root === null) {
              parts[++k] = root = document.createDocumentFragment();
              string += "<!--o:" + k + "-->";
            }
            root.appendChild(node);
          } else {
            root = null;
            string += node;
          }
        }
        root = null;
      } else {
        string += part;
      }
      string += strings[i];
    }

    // Render the text.
    root = render(string);

    // Walk the rendered content to replace comment placeholders.
    if (++k > 0) {
      nodes = new Array(k);
      walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_COMMENT,
        null,
        false
      );
      while (walker.nextNode()) {
        node = walker.currentNode;
        if (/^o:/.test(node.nodeValue)) {
          nodes[+node.nodeValue.slice(2)] = node;
        }
      }
      for (i = 0; i < k; ++i) {
        if ((node = nodes[i])) {
          node.parentNode.replaceChild(parts[i], node);
        }
      }
    }

    // Is the rendered content
    // … a parent of a single child? Detach and return the child.
    // … a document fragment? Replace the fragment with an element.
    // … some other node? Return it.
    return root.childNodes.length === 1
      ? root.removeChild(root.firstChild)
      : root.nodeType === 11
      ? ((node = wrapper()).appendChild(root), node)
      : root;
  };
}

export let md = template(
  function (string) {
    var root = document.createElement("div");
    root.innerHTML = marked(string, { langPrefix: "" }).trim();

    var code = root.querySelectorAll("pre code[class]");
    if (code.length > 0) {
      code.forEach(function (block) {
        function done() {
          hl.highlightElement(block);
          block.parentNode.classList.add("observablehq--md-pre");
        }
        if (hl.getLanguage(block.className)) {
          done();
        } else {
          // import(`highlight.js/es/languages/${block.className}.js`)
          //   .then((language) => {
          //     console.log(`language:`, language);
          //     hl.registerLanguage(block.className, language);
          //     done();
          //   })
          //   .catch((error) => {
          //     console.log(`error:`, error);
          //     console.log(`Language "${block.className}" not found`);
          //   });
        }
      });
    }
    return root;
  },
  function () {
    return document.createElement("div");
  }
);
