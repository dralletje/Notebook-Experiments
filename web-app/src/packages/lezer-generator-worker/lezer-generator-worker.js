import { MagicWorker } from "../worker-typescript-magic/worker-typescript-magic";

/**
 * @extends {MagicWorker<import("./worker.js").Commands>}
 */
export class LezerGeneratorWorker extends MagicWorker {
  constructor() {
    super(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
  }
}
