import { Buffer } from "buffer";
import process from "process";

// if (import.meta.env.PROD) {
globalThis.Buffer = Buffer;
globalThis.process = process;
// }
