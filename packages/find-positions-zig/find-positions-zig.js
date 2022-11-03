let url = new URL("./main.wasm", import.meta.url);
console.log(`url:`, url);
export let webassembly_module = await WebAssembly.compileStreaming(fetch(url));
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
  /** @type {{ current: import("@codemirror/state").Text? }} */
  let doc_ref = { current: null };

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

  /** @type {WebAssembly.Memory} */
  let memory = /** @type {any} */ (instance.exports.memory);
  memory.grow(10);

  /**
   * @param {import("@codemirror/state").Text} doc
   * @param {Uint16Array} treebuffer
   * @param {number} text_offset
   */
  return function tree_from_meta(doc, treebuffer, text_offset) {
    doc_ref.current = doc;

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

    // @ts-ignore
    let result = instance.exports.meta_from_tree(
      treebuffer_position,
      treebuffer.length / 4,
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
