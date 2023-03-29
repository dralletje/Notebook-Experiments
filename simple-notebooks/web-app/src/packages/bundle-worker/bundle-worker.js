import { MagicWorker } from "@dral/worker-typescript-magic";
/**
 * @extends {MagicWorker<import("./bundle-worker-worker.js").Commands>}
 */
export class BundleWorker extends MagicWorker {
  constructor() {
    super(
      new Worker(new URL("./bundle-worker-worker.js", import.meta.url), {
        type: "module",
      })
    );
  }
}
