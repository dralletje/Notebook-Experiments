let url = new URL("./main.wasm", import.meta.url);
console.log(`url:`, url);
let webassembly_module = await WebAssembly.compileStreaming(fetch(url));
console.log(`webassembly_module:`, webassembly_module);

let get_string_from_c_string = (instance, _string) => {
  let [length, location] = new Uint32Array(
    instance.exports.memory.buffer,
    _string,
    2
  );

  const buffer = new Uint8Array(
    instance.exports.memory.buffer,
    location,
    length
  );
  const decoder = new TextDecoder();
  const string = decoder.decode(buffer);
  return string;
};

/**
 * @returns {Promise<WebAssembly.Instance & { exports: { memory: WebAssembly.Memory } }>}
 */
export default async function init(imports = {}) {
  let instance = await WebAssembly.instantiate(webassembly_module, {
    ...imports,
    env: {
      ...imports.env,
      consoleLog: (_string) => {
        console.log(get_string_from_c_string(instance, _string));
      },
      consoleGroup: (_string) => {
        console.group(get_string_from_c_string(instance, _string));
      },
      consoleGroupEnd: () => {
        console.groupEnd();
      },
      consoleTime: (_string) => {
        console.time(get_string_from_c_string(instance, _string));
      },
      consoleTimeEnd: (_string) => {
        console.timeEnd(get_string_from_c_string(instance, _string));
      },
    },
  });

  /** @type {WebAssembly.Memory} */
  let memory = /** @type {any} */ (instance.exports.memory);
  memory.grow(10);

  return /** @type {any} */ (instance);
}
