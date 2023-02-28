let url = new URL("./main.wasm", import.meta.url);

export let webassembly_module_promise = WebAssembly.compileStreaming(
  fetch(url)
);

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
  // performance_now: () => BigInt(Math.round(performance.now() * 1000 * 1000)),
  performance_now: () => performance.now(),
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
  /** @type {{ current: import("@codemirror/state").Text? }} */
  let doc_ref = { current: null };

  let webassembly_module = await webassembly_module_promise;
  let instance = await WebAssembly.instantiate(webassembly_module, {
    ...imports,
    env: {
      ...imports.env,
      ...basic_imports(() => instance),
      slice_doc_number: (from, to) => {
        if (doc_ref.current != null) {
          return parseInt(doc_ref.current.sliceString(from, to));
        }
      },
    },
  });

  // // @ts-ignore
  // instance.exports.test_performance_performance();

  /** @type {WebAssembly.Memory} */
  let memory = /** @type {any} */ (instance.exports.memory);
  memory.grow(10);

  let MEMORY_TIME = 0;
  let wasm_time = 0;
  let get_result_time = 0;

  /**
   * @param {import("@codemirror/state").Text} doc
   * @param {Uint16Array} treebuffer
   * @param {number} text_offset
   */
  function meta_from_tree(doc, treebuffer, text_offset) {
    doc_ref.current = doc;

    let MEMORY_TIME_START = performance.now();
    let treebuffer_position = 0;
    ensure_memory_size(memory, treebuffer_position + treebuffer.length + 4);
    let x = new Uint16Array(
      memory.buffer,
      treebuffer_position,
      treebuffer.length + 4
    );
    x.set(treebuffer);
    x[treebuffer.length] = 0;
    x[treebuffer.length + 1] = 0;
    x[treebuffer.length + 2] = 0;
    x[treebuffer.length + 3] = 0;
    MEMORY_TIME += performance.now() - MEMORY_TIME_START;

    let wasm_time_start = performance.now();
    // @ts-ignore
    let result = instance.exports.meta_from_tree(
      treebuffer_position,
      treebuffer.length / 4,
      text_offset
    );
    wasm_time += performance.now() - wasm_time_start;

    let get_result_time_start = performance.now();
    let result_array = new Uint32Array(memory.buffer, result);
    // console.time("to ranges");
    for (let i = 0; i < result_array.length; i += 4) {
      if (
        result_array[i] == 0 &&
        result_array[i + 1] == 0 &&
        result_array[i + 2] == 0 &&
        result_array[i + 3] == 0
      ) {
        get_result_time += performance.now() - get_result_time_start;
        // selectable_memory_stuff.push(aaa.slice(0, i));
        return new Uint32Array(result_array.buffer, result_array.byteOffset, i);
      }
    }
    get_result_time += performance.now() - get_result_time_start;
    throw new Error("No end found in returned array...");
  }

  function reset_timing() {
    console.log("Memory copy", MEMORY_TIME);
    console.log("Wasm time (as seen from JS)", wasm_time);

    console.group("WASM TIMINGS");
    // @ts-ignore
    instance.exports.reset_timing();
    console.groupEnd();

    console.log("Get result time", get_result_time);
    MEMORY_TIME = 0;
    wasm_time = 0;
    get_result_time = 0;
  }

  return { meta_from_tree, reset_timing };
}
