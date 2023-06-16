let url = new URL("../main.wasm", import.meta.url);
let webassembly_module = await WebAssembly.compileStreaming(fetch(url));

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

let get_a_number = () => {
  return 42;
};

var suspending_get_a_number = new WebAssembly.Function(
  { parameters: [], results: ["i32"] },
  get_a_number
  // { suspending: "first" }
);

export let jspi = await WebAssembly.instantiate(webassembly_module, {
  env: {
    ...basic_imports(() => jspi),
    get_a_number: suspending_get_a_number,
  },
});

let promising_jspi = new WebAssembly.Function(
  { parameters: [], results: ["i32"] },
  jspi.exports.jspi,
  { promising: "first" }
);

export let test = () => {
  return promising_jspi();
};
