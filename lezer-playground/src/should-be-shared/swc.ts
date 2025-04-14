import url from "@swc/wasm-web/wasm_bg.wasm?url";
import init from "@swc/wasm-web";

export * from "@swc/wasm-web";

await init(url);
