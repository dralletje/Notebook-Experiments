# Worker-Typescript-Magic

Typechecked workers.

## Usage

In your worker file:

```javascript
import { handleCalls } from "worker-typescript-magic/worker";

let commands = {
  /** @param {{ x: number, y: number }} data */
  sum: async ({ x, y }) => {
    return x + y;
  },
};

/**
 * @typedef Commands
 * @type {typeof commands}
 */
// Or in typescript
export type Commands = typeof commands;

handleCalls(commands);
```

In your main export:

```javascript
import { MagicWorker } from "worker-typescript-magic";

/**
 * @extends {MagicWorker<import("./worker.js").Commands>}
 */
export class CustomWorker extends MagicWorker {
  constructor() {
    super(new URL("./worker.js", import.meta.url), { type: "module" });
  }
}
```
