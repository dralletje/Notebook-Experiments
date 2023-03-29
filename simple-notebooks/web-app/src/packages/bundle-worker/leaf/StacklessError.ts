export class StacklessError extends Error {
  constructor(error: Error);
  constructor(error: string, options?: { cause: any });
  constructor(error: string | Error, options?: { cause: any }) {
    if (error instanceof Error) {
      super(error.message, { cause: error });
    } else {
      super(error);
    }

    this.stack = "";
  }
}
