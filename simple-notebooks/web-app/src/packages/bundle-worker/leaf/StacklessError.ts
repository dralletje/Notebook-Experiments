export class StacklessError extends Error {
  constructor(error: string | Error) {
    if (error instanceof Error) {
      super(error.message, { cause: error });
    } else {
      super(error);
    }

    this.stack = "";
  }
}
