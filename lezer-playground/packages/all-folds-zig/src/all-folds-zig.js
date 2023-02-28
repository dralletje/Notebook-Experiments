let url = new URL("../main.wasm", import.meta.url);
let webassembly_module_promise = WebAssembly.compileStreaming(fetch(url));

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

let basic_imports = (instance_fn) => ({
  consoleLog: (_string) => {
    console.log(get_string_from_c_string(instance_fn(), _string));
  },
  consoleGroup: (_string) => {
    console.group(get_string_from_c_string(instance_fn(), _string));
  },
  consoleGroupEnd: () => {
    console.groupEnd();
  },
  consoleTime: (_string) => {
    console.time(get_string_from_c_string(instance_fn(), _string));
  },
  consoleTimeEnd: (_string) => {
    console.timeEnd(get_string_from_c_string(instance_fn(), _string));
  },
});

let make_sure_it_even = (x) => {
  return Math.ceil(x / 2) * 2;
};

/**
 * @param {WebAssembly.Memory} memory
 * @param {number} size
 */
let ensure_memory_size = (memory, size) => {
  while (size > memory.buffer.byteLength) {
    memory.grow(1);
  }
};

export default async function init(imports = {}) {
  let webassembly_module = await webassembly_module_promise;

  let instance = await WebAssembly.instantiate(webassembly_module, {
    ...imports,
    env: {
      ...imports.env,
      ...basic_imports(() => instance),
    },
  });

  /** @type {WebAssembly.Memory} */
  let memory = /** @type {any} */ (instance.exports.memory);
  memory.grow(10);

  /**
   * @param {import("@lezer/common").TreeBuffer} treebuffer
   * @param {number} text_offset
   */
  return function all_folds_zig(treebuffer, text_offset) {
    let buffer = treebuffer.buffer;

    let buffer_position = 0;
    ensure_memory_size(memory, buffer_position + buffer.length + 4);
    let x = new Uint16Array(memory.buffer, buffer_position, buffer.length + 4);
    x.set(buffer);
    x[buffer.length] = 0;
    x[buffer.length + 1] = 0;
    x[buffer.length + 2] = 0;
    x[buffer.length + 3] = 0;

    // @ts-ignore
    let result = instance.exports.all_folds(
      buffer_position,
      buffer.length / 4,
      text_offset
    );

    let result_array = new Uint32Array(memory.buffer, result);

    // console.time("to ranges");
    for (let i = 0; i < result_array.length; i += 4) {
      if (
        result_array[i] == 0 &&
        result_array[i + 1] == 0 &&
        result_array[i + 2] == 0 &&
        result_array[i + 3] == 0
      ) {
        // selectable_memory_stuff.push(aaa.slice(0, i));
        return new Uint32Array(result_array.buffer, result_array.byteOffset, i);
      }
    }
    throw new Error("No end found in returned array...");
  };
}
