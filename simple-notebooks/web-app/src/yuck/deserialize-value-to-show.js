import { html } from "htl";
import { md } from "md-literal";

let create_function_with_name_and_body = (
  name,
  body,
  modifier = "function"
) => {
  try {
    return new Function(`return ${modifier} ${name}(){ ${body} }`)();
  } catch (e) {
    try {
      return new Function(
        `return ${modifier} ${name}(){ /* Couldn't set function body */ }`
      )();
    } catch (e) {
      return () => {};
    }
  }
};

export let deserialize = (index, heap, result_heap = {}) => {
  if (result_heap[index] != null) return result_heap[index];
  let result = heap[index];

  try {
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
      return create_function_with_name_and_body(
        result.value.name,
        result.value.body
      );
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
      return error;
    } else if (result.type === "set") {
      let xs = [];
      result_heap[index] = xs;
      for (let { key, value } of result.value) {
        xs.push(deserialize(value, heap, result_heap));
      }
      return new Set(xs);
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
    } else if (result.type === "@observablehq/md") {
      // Special type for htl HTML, to not mess around to much I just put the values
      // in the heap and then use the htl library to deserialize it.
      // No need for a server-side rendering of the HTML, just use the client-side.
      let [strings, ...interpolations] = deserialize(
        result.value,
        heap,
        result_heap
      );
      return md(strings, ...interpolations);
    } else if (result.type === "@ecmascript/class") {
      let my_class = class {};
      result_heap[index] = my_class;
      try {
        my_class = eval(`let x = class ${result.name} {}; x`);
      } catch {}
      for (let [key, serialized] of result.statics) {
        try {
          my_class[key] = deserialize(serialized, heap, result_heap);
        } catch {}
      }
      return my_class;
    } else if (result.type === "@ecmascript/object") {
      let thing = {};
      result_heap[index] = thing;
      Object.defineProperty(thing, "constructor", {
        value: deserialize(result.constructor, heap, result_heap),
        enumerable: false,
      });
      Object.assign(thing, deserialize(result.object, heap, result_heap));
      if (result.prototype != null) {
        Object.setPrototypeOf(
          thing,
          deserialize(result.prototype, heap, result_heap)
        );
      }

      return thing;
    } else if (result.type === "@ecmascript/async-function") {
      return create_function_with_name_and_body(
        result.value.name,
        result.value.body,
        "async function"
      );
    } else if (result.type === "@ecmascript/promise") {
      return Promise.resolve();
    } else if (result.type === "text/html") {
      let div = document.createElement("div");
      div.innerHTML = result.value;
      return div;
    } else {
      return { $cant_deserialize: result };
    }
  } catch (error) {
    console.error(`DESERIALIZE ERROR:`, error, { result });
    return { $deserialize_error: error };
  }
};
