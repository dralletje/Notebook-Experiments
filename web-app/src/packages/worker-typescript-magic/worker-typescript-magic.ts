let commands = {
  "transform-code": async ({ code }: { code: string }) => {
    return 10;
  },
  "notebook-to-file": async ({ notebook }: { notebook: string }) => {
    return "hi";
  },
};

class ErrorFromWorker extends Error {
  constructor(message, stack) {
    super(message);
    this.stack = stack;
  }
}

export type GenericCommands = { [key: string]: (x: any) => any };
export class MagicWorker<T extends GenericCommands> extends Worker {
  private request_id_counter = 1;

  async request<P extends keyof T>(
    method: P,
    data: Parameters<T[P]>[0]
  ): Promise<ReturnType<T[P]>> {
    let request_id = this.request_id_counter++;

    this.postMessage({
      request_id: request_id,
      request: { type: method, data: data },
    });

    return await new Promise((resolve, reject) => {
      let handle_message = (message) => {
        if (message.data.request_id === request_id) {
          cleanup();
          console.log(`message:`, message.data);

          if (message.data.type === "success") {
            resolve(message.data.result);
          } else if (message.data.type === "error") {
            reject(
              new ErrorFromWorker(
                message.data.error.message,
                message.data.error.stack
              )
            );
          } else {
            reject(new Error("Unknown message type"));
          }
        }
      };
      let handle_error = (error) => {
        cleanup();
        reject(error);
      };
      let cleanup = () => {
        this.removeEventListener("message", handle_message);
        this.removeEventListener("error", handle_error);
      };
      this.addEventListener("message", handle_message);
      this.addEventListener("error", handle_error);
    });
  }
}

// type WorkerFunctions<T> = T extends MyWorker<infer R> ? R : never

// let my_worker: MyWorker<typeof commands> = null as any

// let result2 = await my_worker.call("notebook-to-file", { notebook: "asd" })

// export {}
