// ╔═╡ DRAL_NOTEBOOK_VERSION = "0.0.1"
export {};

// ╔═╡ [cells.a6597523-ba51-4c80-8094-f6b326ff1a1c]
// ╠═╡ type = "text"
// # Composite Key
// Based on the [compositeKey proposal](https://github.com/tc39/proposal-richer-keys/tree/master/compositeKey),
// copying some other repo pretty much ad-hoc. <small>(Need to find that repo again)</small>

// ╔═╡ [cells.a0d8f315-dca3-4adc-986b-a1f3f8278bb7]
// ╠═╡ type = "text"
// ```
// npm install composite-key
// ```

// ╔═╡ [cells.60960b22-1b24-4379-9a5e-35d2b0b9b728]
// ╠═╡ folded = true
type Tuple = any[];
const hasLifetime = (value: any) =>
  value !== null && (typeof value === "object" || typeof value === "function");

// ╔═╡ [cells.3ae7fd0a-a979-4a1a-9e3c-8940abc739b9]
// ╠═╡ folded = true
const composity_key_parts_symbol = Symbol("Parts (DO NOT USE THIS IN CODE)");

// ╔═╡ [cells.85aaff35-cb40-410a-b27f-375b1b9ac265]
// ╠═╡ folded = true
export class CompositeKey<T extends Tuple> {
  [composity_key_parts_symbol]: [...T];
  constructor(keys: [...T]) {
    this[composity_key_parts_symbol] = keys;
    Object.freeze(this);
  }
}

// ╔═╡ [cells.8f592a18-7508-4473-8a02-2da894bf0f16]
// ╠═╡ folded = true
class CompositeNode {
  primitiveNodes = new Map<any, any>();
  value: CompositeKey<any>;
  get<T extends Tuple>(keys: [...T]) {
    this.value ??= new CompositeKey(keys);
    return this.value;
  }
  emplacePrimitive(value: any, position: number) {
    if (!this.primitiveNodes.has(value)) {
      this.primitiveNodes.set(value, new Map());
    }
    let positions = this.primitiveNodes.get(value);
    if (!positions.has(position)) {
      positions.set(position, new CompositeNode());
    }
    return positions.get(position);
  }
}

// ╔═╡ [cells.7d818a46-5e08-476a-b077-2f0768cb5d43]
// ╠═╡ folded = true
class CompositeNodeWithLifetime extends CompositeNode {
  lifetimeNodes = new WeakMap<any, any>();
  emplaceLifetime(value: any, position: number) {
    if (!this.lifetimeNodes.has(value)) {
      this.lifetimeNodes.set(value, new Map());
    }
    let positions = this.lifetimeNodes.get(value);
    if (!positions.has(position)) {
      positions.set(position, new CompositeNodeWithLifetime());
    }
    return positions.get(position);
  }
}

// ╔═╡ [cells.d5340b7a-5803-4403-acbd-0c8b548bc971]
// ╠═╡ folded = true
const compoundStore = new CompositeNodeWithLifetime();
// accepts multiple objects as a key and does identity on the parts of the iterable
export const compositeKey = <T extends Tuple = any[]>(
  ...parts: T
): CompositeKey<[...T]> => {
  let node = compoundStore;
  for (let i = 0; i < parts.length; i++) {
    const value = parts[i];
    if (hasLifetime(value)) {
      node = node.emplaceLifetime(value, i);
    }
  }
  // does not leak WeakMap paths since there are none added
  if (node === compoundStore) {
    // prettier-ignore
    throw new TypeError("Composite keys must contain a non-primitive component");
  }
  for (let i = 0; i < parts.length; i++) {
    const value = parts[i];
    if (!hasLifetime(value)) {
      node = node.emplacePrimitive(value, i);
    }
  }
  return node.get(parts);
};

// ╔═╡ [cells.b7588794-f86e-457c-b36d-b16ea0dc8d32]
// ╠═╡ folded = false
let arbitrarily_object = {};

// ╔═╡ [cells.996dd129-f8d1-4e5c-a0f5-7a35bc280ee2]
// ╠═╡ folded = false
let KEY_1 = compositeKey(arbitrarily_object, "hi");

// ╔═╡ [cells.5c9ad22e-0b6c-46fa-9625-5d1acc47ac21]
// ╠═╡ folded = false
let KEY_2 = compositeKey(arbitrarily_object, "hi");

// ╔═╡ [cells.180871cb-cf51-4a54-93d7-6a6a9c626640]
// ╠═╡ folded = false
let my_weakmap = new WeakMap();
my_weakmap.set(KEY_1, { x: "Oheythere!" });
my_weakmap.get(KEY_2);

// ╔═╡ [cells.4e867d45-51bd-4539-a30a-cf290b31caac]
// ╠═╡ folded = false
KEY_1 === KEY_2;

// ╔═╡ [cells.76c84e2e-4fc0-4ebf-a8cd-899f563f1434]
// ╠═╡ type = "text"
// #### Difference from the proposal
// - Instead of returning an object with null prototype, and no properties, I want something nice to look at so I make it an `CompositeKey` with the parts it was created from as property. Ideally I have a way to prevent code from accessing the property.

// ╔═╡ [cells.154da72c-8840-412e-9f52-07e1010f241b]
// ╠═╡ type = "text"
// #### compositeSymbol (way less interesing, but it is in the proposal)

// ╔═╡ [cells.18206004-d632-48fa-82df-af4e9fd4b158]
// ╠═╡ folded = true
const symbols = new WeakMap();
export const compositeSymbol = (...parts: any) => {
  if (parts.length === 1 && typeof parts[0] === "string") {
    return Symbol.for(parts[0]);
  }
  const key = compositeKey(symbols, ...parts);
  if (!symbols.has(key)) symbols.set(key, Symbol());
  return symbols.get(key);
};

// ╔═╡ [cells.608c2a8f-ebde-478c-8d16-aa5a666a4a84]
// ╠═╡ type = "text"
// ## Implementation

// ╔═╡ ["Cell Order"]
// ╠═╡ "Cell Order" = [
// ╠═╡   "a6597523-ba51-4c80-8094-f6b326ff1a1c",
// ╠═╡   "a0d8f315-dca3-4adc-986b-a1f3f8278bb7",
// ╠═╡   "d5340b7a-5803-4403-acbd-0c8b548bc971",
// ╠═╡   "b7588794-f86e-457c-b36d-b16ea0dc8d32",
// ╠═╡   "996dd129-f8d1-4e5c-a0f5-7a35bc280ee2",
// ╠═╡   "5c9ad22e-0b6c-46fa-9625-5d1acc47ac21",
// ╠═╡   "180871cb-cf51-4a54-93d7-6a6a9c626640",
// ╠═╡   "4e867d45-51bd-4539-a30a-cf290b31caac",
// ╠═╡   "76c84e2e-4fc0-4ebf-a8cd-899f563f1434",
// ╠═╡   "154da72c-8840-412e-9f52-07e1010f241b",
// ╠═╡   "18206004-d632-48fa-82df-af4e9fd4b158",
// ╠═╡   "608c2a8f-ebde-478c-8d16-aa5a666a4a84",
// ╠═╡   "3ae7fd0a-a979-4a1a-9e3c-8940abc739b9",
// ╠═╡   "85aaff35-cb40-410a-b27f-375b1b9ac265",
// ╠═╡   "7d818a46-5e08-476a-b077-2f0768cb5d43",
// ╠═╡   "8f592a18-7508-4473-8a02-2da894bf0f16",
// ╠═╡   "60960b22-1b24-4379-9a5e-35d2b0b9b728"
// ╠═╡ ]
