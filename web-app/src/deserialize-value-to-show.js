import { html } from "htl";

let create_function_with_name_and_body = (name, body) => {
  var func = new Function(`return function ${name}(){ ${body} }`)();
  return func;
};

export let deserialize = (index, heap, result_heap = {}) => {
  if (result_heap[index] != null) return result_heap[index];

  let result = heap[index];
  if (result.type === "object") {
    let x = {};
    result_heap[index] = x;
    for (let { key, value } of result.value) {
      x[deserialize(key, heap)] = deserialize(value, heap, result_heap);
    }
    return x;
  } else if (result.type === "array") {
    let xs = [];
    result_heap[index] = xs;
    for (let value of result.value) {
      xs.push(deserialize(value, heap, result_heap));
    }
    return xs;
  } else if (result.type === "string") {
    return result.value;
  } else if (result.type === "number") {
    return result.value;
  } else if (result.type === "boolean") {
    return result.value;
  } else if (result.type === "null") {
    return null;
  } else if (result.type === "undefined") {
    return undefined;
  } else if (result.type === "function") {
    return create_function_with_name_and_body(result.name, result.body);
  } else if (result.type === "symbol") {
    return Symbol(result.value);
  } else if (result.type === "date") {
    return new Date(result.value);
  } else if (result.type === "regexp") {
    return new RegExp(result.value.src, result.value.flags);
  } else if (result.type === "error") {
    let error = new Error(result.value.message);
    error.name = result.value.name;
    error.stack = result.value.stack;
    console.log(`error:`, error);
    return error;
  } else if (result.type === "nan") {
    return NaN;
  } else if (result.type === "@observablehq/htl") {
    // Special type for htl HTML, to not mess around to much I just put the values
    // in the heap and then use the htl library to deserialize it.
    // No need for a server-side rendering of the HTML, just use the client-side.
    let [strings, ...interpolations] = deserialize(
      result.value,
      heap,
      result_heap
    );
    return html({ raw: strings }, ...interpolations);
  } else {
    return { $cant_deserialize: result };
  }
};
