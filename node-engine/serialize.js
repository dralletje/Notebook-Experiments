const typedArrTypes = [
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float32Array",
  "Float64Array",
];

/**
 * @returns {import("./node-engine").Serialized}
 */
export default (entry, context) => {
  const m = new Map();
  const heap = [];

  function encounterFunction(func) {
    const found = m.get(func);
    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(func, id);

    const value = {
      name: func.name,
      body: Function.prototype.toString.call(func),
      proto: Object.getPrototypeOf(func).constructor.name,
    };

    heap.push({ type: "function", value });

    return id;
  }

  function encounterPlainObj(plainObj) {
    const found = m.get(plainObj);
    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(plainObj, id);

    const refArray = [];
    heap.push({ type: "object", value: refArray });

    for (const key in plainObj) {
      if (Object.prototype.hasOwnProperty.call(plainObj, key)) {
        // Don't serialize the __proto__ for now
        refArray.push({
          key: serializeValue(key),
          value: serializeValue(plainObj[key]),
        });
      }
    }

    return id;
  }

  function encounterArr(arr) {
    const found = m.get(arr);
    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(arr, id);

    const refArray = [];
    heap.push({ type: "array", value: refArray });

    for (const v of arr) {
      refArray.push(serializeValue(v));
    }

    return id;
  }

  function encounterSetOrMap(map, type) {
    const found = m.get(map);

    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(map, id);

    const refArray = [];
    heap.push({ type, value: refArray });

    for (const [k, v] of map.entries()) {
      refArray.push({
        key: serializeValue(k),
        value: serializeValue(v),
      });
    }

    return id;
  }

  function encounterDate(date) {
    const found = m.get(date);

    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(date, id);

    heap.push({ type: "date", value: date.getTime() });

    return id;
  }

  function encounterRegex(regex) {
    const found = m.get(regex);

    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(regex, id);

    const value = {
      src: regex.source,
      flags: "",
    };
    if (regex.global) value.flags += "g";
    if (regex.ignoreCase) value.flags += "i";
    if (regex.multiline) value.flags += "m";

    heap.push({ type: "regexp", value });

    return id;
  }

  function encounterError(error) {
    const found = m.get(error);

    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(error, id);

    const value = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    heap.push({ type: "error", value });

    return id;
  }

  function encounterArrBuff(buff) {
    const found = m.get(buff);

    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(buff, id);

    const view = new Int8Array(buff);
    const value = Array.prototype.slice.call(view);

    heap.push({ type: "arraybuffer", value });

    return id;
  }

  function encounterTypedArray(view, ctor) {
    const found = m.get(view);

    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(view, id);

    const value = {
      ctor,
      viewArr: Array.prototype.slice.call(view),
    };

    heap.push({ type: "typedarray", value });

    return id;
  }

  function encounterSymbol(sym) {
    const found = m.get(sym);

    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(sym, id);

    const value = sym.toString().slice(7, -1);

    heap.push({ type: "symbol", value });

    return id;
  }

  function encounterDOMNode(node) {
    const found = m.get(node);
    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(node, id);

    const serializer = new window.XMLSerializer();

    const value = serializer.serializeToString(node);

    heap.push({ type: "domnode", value });

    return id;
  }

  function encounterNodeList(nodeList) {
    const found = m.get(nodeList);
    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(nodeList, id);

    const refArray = [];

    heap.push({ type: "nodelist", value: refArray });

    Array.prototype.forEach.call(nodeList, (node) => {
      refArray.push(serializeValue(node));
    });

    return id;
  }

  function encounterHtmlCollection(collection) {
    const found = m.get(collection);
    if (typeof found === "number") {
      return found;
    }

    const id = heap.length;
    m.set(collection, id);

    const refArray = [];

    heap.push({ type: "htmlcollection", value: refArray });

    Array.prototype.forEach.call(collection, (node) => {
      refArray.push(serializeValue(node));
    });

    return id;
  }

  function serializeValue(obj) {
    switch (typeof obj) {
      case "undefined": {
        heap.push({ type: "undefined", value: "" });

        return heap.length - 1;
      }
      case "string": {
        heap.push({ type: "string", value: obj });

        return heap.length - 1;
      }
      case "number": {
        // eslint-disable-next-line no-self-compare
        if (obj !== obj) {
          // NaN
          heap.push({ type: "nan", value: "" });
        } else if (obj === context.Infinity) {
          heap.push({ type: "infinity", value: "+" });
        } else if (obj === -context.Infinity) {
          // Negative infinite
          heap.push({ type: "infinity", value: "-" });
        } else if (1 / obj === -Infinity) {
          // Negative 0, thanks JS!
          heap.push({ type: "neg0", value: "" });
        } else {
          heap.push({ type: "number", value: obj });
        }

        return heap.length - 1;
      }

      case "boolean": {
        heap.push({ type: "boolean", value: obj });

        return heap.length - 1;
      }

      case "bigint":
        heap.push({ type: "bigint", value: obj.toString() });

        return heap.length - 1;

      case "symbol":
        return encounterSymbol(obj);

      case "function":
        return encounterFunction(obj);

      case "object": {
        if (obj === null) {
          heap.push({ type: "null", value: "" });

          return heap.length - 1;
        }

        if (obj instanceof context.Map) {
          return encounterSetOrMap(obj, "map");
        }

        if (obj instanceof context.Set) {
          return encounterSetOrMap(obj, "set");
        }

        if (obj instanceof context.Date) {
          return encounterDate(obj);
        }

        if (obj instanceof context.RegExp) {
          return encounterRegex(obj);
        }

        if (obj instanceof context.Error) {
          return encounterError(obj);
        }

        if (obj instanceof context.ArrayBuffer) {
          return encounterArrBuff(obj);
        }

        for (const type of typedArrTypes) {
          if (obj instanceof context[type]) {
            console.log(obj, type);
            return encounterTypedArray(obj, type);
          }
        }

        if (obj instanceof context.Array) {
          return encounterArr(obj);
        }

        if (
          "Node" in context &&
          "NodeList" in context &&
          "HTMLCollection" in context
        ) {
          // Dom context only
          if (obj instanceof context.Node) {
            return encounterDOMNode(obj);
          }

          if (obj instanceof context.NodeList) {
            return encounterNodeList(obj);
          }

          if (obj instanceof context.HTMLCollection) {
            return encounterHtmlCollection(obj);
          }
        }

        return encounterPlainObj(obj);
      }

      default:
        throw new Error("Unkown type");
    }
  }

  serializeValue(entry);

  const result = {};

  for (let i = 0; i < heap.length; i++) {
    result[i] = heap[i];
  }

  return result;
};
