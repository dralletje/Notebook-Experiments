import { MagicWorker } from "@dral/worker-typescript-magic";
/**
 * @extends {MagicWorker<import("./lezer-generator-worker-worker.js").Commands>}
 */
export class LezerGeneratorWorker extends MagicWorker {
  constructor() {
    super(
      new Worker(
        new URL("./lezer-generator-worker-worker.js", import.meta.url),
        { type: "module" }
      )
    );
  }
}
