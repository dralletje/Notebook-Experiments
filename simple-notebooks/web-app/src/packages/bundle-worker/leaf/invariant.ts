export class InvariantError extends Error {}

export let invariant = (condition: boolean, message: string) => {
  if (!condition) {
    throw new InvariantError(message);
  }
};
