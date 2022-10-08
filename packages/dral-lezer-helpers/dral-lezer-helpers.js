import { TreeCursor } from "@lezer/common";

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
 *  enter: (cursor: TreeCursor) => (void | boolean),
 *  leave?: (cursor: TreeCursor) => (void | boolean),
 *  from?: number,
 *  to?: number,
 *  skip_first_container?: boolean,
 * }} options
 */
export function iterate_over_cursor({
  cursor,
  enter,
  leave,
  from = cursor.from,
  to = cursor.to,
  skip_first_container = false,
}) {
  let depth = 0

  while (true) {
    let mustLeave = false;
    if (
      cursor.from <= to &&
      cursor.to >= from &&
      (cursor.type.isAnonymous || enter(cursor, depth) !== false)
    ) {
      if (cursor.firstChild()) {
        depth++
        continue;
      };
      if (!cursor.type.isAnonymous) mustLeave = true;
    }
    while (true) {
      if (mustLeave && leave) leave(cursor);
      mustLeave = cursor.type.isAnonymous;
      if (cursor.nextSibling()) break;
      if (!cursor.parent()) {
        if (did_skip_first_container) {
          cursor.parent();
        }
        return;
      }
      mustLeave = true;
    }
  }
}
