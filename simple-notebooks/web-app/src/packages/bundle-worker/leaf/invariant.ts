export class InvariantError extends Error {}

/**
 * What makes `invariant` special to me?
 * Invariant errors are for me: they should never happen if the code is written correct.
 * This shouldn't be used for user input validation and the like.
 */
export function invariant(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}
