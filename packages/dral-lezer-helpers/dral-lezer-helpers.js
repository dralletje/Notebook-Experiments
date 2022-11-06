import { Tree, TreeBuffer, TreeCursor } from "@lezer/common";

/**
 * Like Lezers `iterate`, but instead of `{ from, to, getNode() }`
 * this will give `enter()` and `leave()` the `cursor` (which can be efficiently matched with lezer template)
 *
 * @param {{
 *  tree: any,
 *  enter: (cursor: TreeCursor) => (void | boolean),
 *  leave?: (cursor: TreeCursor) => (void | boolean),
 *  from?: number,
 *  to?: number,
 * }} options
 */
export function iterate_with_cursor({
  tree,
  enter,
  leave,
  from = 0,
  to = tree.length,
}) {
  let cursor = tree.cursor();
  return iterate_over_cursor({
    cursor: cursor,
    enter,
    leave,
    from,
    to,
  });
}

/**
 * Like Lezers `iterate`, but instead of `{ from, to, getNode() }`
 * this will give `enter()` and `leave()` the `cursor` (which can be efficiently matched with lezer template)
 *
 * @param {{
 *  cursor: TreeCursor,
 *  enter: (cursor: TreeCursor, depth: number) => (void | boolean),
 *  leave?: (cursor: TreeCursor, depth: number) => (void | boolean),
 *  from?: number,
 *  to?: number,
 * }} options
 */
export function iterate_over_cursor({
  cursor,
  enter,
  leave,
  from = cursor.from,
  to = cursor.to,
}) {
  let depth = 0;

  while (true) {
    let mustLeave = false;
    if (
      cursor.from <= to &&
      cursor.to >= from &&
      (cursor.type.isAnonymous || enter(cursor, depth) !== false)
    ) {
      if (cursor.firstChild()) {
        depth++;
        continue;
      }
      if (!cursor.type.isAnonymous) mustLeave = true;
    }
    while (true) {
      if (mustLeave && leave) leave(cursor, depth);
      mustLeave = cursor.type.isAnonymous;
      if (cursor.nextSibling()) break;
      if (!cursor.parent()) return;
      depth--;
      if (depth <= 0) return;
      mustLeave = true;
    }
  }
}

/**
 * @param {{
 *  enter_tree: (tree: Tree, offset: number) => void | false,
 *  enter_treebuffer: (tree: TreeBuffer, offset: number) => void | false,
 *  verbose?: boolean,
 * }} context
 * @param {Tree | TreeBuffer} tree
 * @param {number} offset
 */
export let _iterate_trees = (context, tree, offset) => {
  let { verbose, enter_tree, enter_treebuffer } = context;
  if (tree instanceof Tree) {
    verbose && console.group(`TREE "${tree.type.name}" ${offset}`);
    verbose && console.log(`tree:`, tree);

    let should_enter = enter_tree(tree, offset);

    if (should_enter !== false) {
      for (let i = 0; i < tree.children.length; i++) {
        _iterate_trees(context, tree.children[i], offset + tree.positions[i]);
      }
    }
    verbose && console.groupEnd();
  } else {
    verbose && console.group(`BUFFER ${offset}`);
    enter_treebuffer(tree, offset);
    verbose && console.groupEnd();
  }
};

/**
 * @param {{
 *  tree: Tree | TreeBuffer,
 *  enter_tree: (tree: Tree, offset: number) => void | false,
 *  enter_treebuffer: (tree: TreeBuffer, offset: number) => void | false,
 *  offset?: number,
 *  verbose?: boolean,
 * }} params
 */
export let iterate_trees = ({ offset = 0, tree, ...context }) => {
  return _iterate_trees(context, tree, offset);
};
