// ╔═╡ DRAL_NOTEBOOK_VERSION = "0.0.1"
export {};

// ╔═╡ [cells.6f02384d-2362-4167-92ca-ef2f5707d375]
// ╠═╡ type = "text"
// # My Title is Awesome

// ╔═╡ [cells.87b3328c-a47d-4431-934c-67289b534115]
// ╠═╡ folded = false
import { Generator } from "@jspm/generator";

// ╔═╡ [cells.980db4ac-bac3-47c7-a559-845b3d455821]
// ╠═╡ folded = false
import { mapValues, escapeRegExp, zip } from "lodash-es";

// ╔═╡ [cells.9a8fc483-556b-40d0-8026-a6eb83127449]
// ╠═╡ folded = false
let error = (message, cause) => {
  throw new Error(message, { cause });
};

// ╔═╡ [cells.3832e250-b538-4856-a496-106b217a8473]
// ╠═╡ folded = false
console.log("HI");

// ╔═╡ [cells.0d236e53-7f21-413b-b8e7-d2a4f2c88ab8]
// ╠═╡ folded = false
let regexp = ({ raw: [first_string, ...strings] }, ...values) => {
  let str = first_string;
  for (let [value, string] of zip(values, strings)) {
    str +=
      typeof value === "string"
        ? escapeRegExp(value)
        : value instanceof RegExp
        ? value.source
        : error("Invalid value in regexp tag", { value });
    str += string;
  }
  return new RegExp(str);
};

// ╔═╡ [cells.0a843916-2744-4255-9068-bcfc3c2a6627]
// ╠═╡ folded = false
let SEMVER_REGEX = regexp`\d+\.\d+\.\d+`;

// ╔═╡ [cells.67405edc-886c-4733-b930-db47d6a018ff]
// ╠═╡ folded = false
const generator = new Generator({
  defaultProvider: "esm.sh",
  env: ["development", "browser", "module"],
});
await generator.install([
  { target: "react" },
  { target: "react-dom" },
  { target: "lodash" },
]);
let map = generator.getMap();

// ╔═╡ [cells.1245e0b1-c293-428e-9c6f-5e3881a5de40]
// ╠═╡ folded = false
let PREFIX = "https://esm.sh/*";
let CDN_REGEX = regexp`^${PREFIX}(?<n>[^@]+)@(?<v>${SEMVER_REGEX})(?<p>.*)`;
let parse_esm_url = (url) => {
  try {
    let { n, v, p } = url.match(CDN_REGEX).groups;
    return {
      name: n,
      version: v,
      path: p,
    };
  } catch (error) {
    throw new Error(`Couldn't parse "${url}"`, {
      cause: error,
    });
  }
};
let versions = mapValues(map.imports, (x) => parse_esm_url(x));

// ╔═╡ [cells.d853fb74-cbf6-411f-990a-77b8df034897]
// ╠═╡ folded = false
let make_skypack_url = ({ name, version, path }) => {
  return `https://cdn.skypack.dev/${name}@${version}${path}?dts`;
};
let skypack_urls = mapValues(versions, make_skypack_url);

// ╔═╡ [cells.cec570ec-b4de-4be9-aea0-9f313d15800a]
// ╠═╡ folded = false
let response = await fetch(skypack_urls.lodash);
let where_them_type = response.headers.get("x-typescript-types");
let type_url = new URL(where_them_type, skypack_urls.lodash).toString();

// ╔═╡ [cells.d1a94d87-efd3-4f78-a5e7-6d1ec30c4de3]
// ╠═╡ folded = false
let types_response = await fetch(type_url);
let text = await types_response.text();

// ╔═╡ [cells.eed61bda-4174-42e9-a90e-4b0243d7d6f0]
// ╠═╡ folded = false
// This cell was in the cell order but not in the notebook

// ╔═╡ [cells.ef0a0a1a-24ed-4f56-8ba0-7591c1e5d56f]
// ╠═╡ folded = false
// This cell was in the cell order but not in the notebook

// ╔═╡ [cells.28918307-ec74-4909-8b06-4d0eb6b82718]
// ╠═╡ folded = false
// This cell was in the cell order but not in the notebook

// ╔═╡ [cells.9b149216-2ed6-4ff0-ac83-bff721613f5a]
// ╠═╡ folded = false
// This cell was in the cell order but not in the notebook

// ╔═╡ [cells.3040d168-18f8-478e-af27-a93db12c1493]
// ╠═╡ folded = false
// This cell was in the cell order but not in the notebook

// ╔═╡ [cells.83d6c607-46fa-446a-9bb5-b019fc626f2e]
// ╠═╡ folded = false
// This cell was in the cell order but not in the notebook

// ╔═╡ ["Cell Order"]
// ╠═╡ "Cell Order" = [
// ╠═╡   "6f02384d-2362-4167-92ca-ef2f5707d375",
// ╠═╡   "87b3328c-a47d-4431-934c-67289b534115",
// ╠═╡   "980db4ac-bac3-47c7-a559-845b3d455821",
// ╠═╡   "9a8fc483-556b-40d0-8026-a6eb83127449",
// ╠═╡   "3832e250-b538-4856-a496-106b217a8473",
// ╠═╡   "0d236e53-7f21-413b-b8e7-d2a4f2c88ab8",
// ╠═╡   "0a843916-2744-4255-9068-bcfc3c2a6627",
// ╠═╡   "67405edc-886c-4733-b930-db47d6a018ff",
// ╠═╡   "1245e0b1-c293-428e-9c6f-5e3881a5de40",
// ╠═╡   "d853fb74-cbf6-411f-990a-77b8df034897",
// ╠═╡   "cec570ec-b4de-4be9-aea0-9f313d15800a",
// ╠═╡   "d1a94d87-efd3-4f78-a5e7-6d1ec30c4de3",
// ╠═╡   "eed61bda-4174-42e9-a90e-4b0243d7d6f0",
// ╠═╡   "ef0a0a1a-24ed-4f56-8ba0-7591c1e5d56f",
// ╠═╡   "28918307-ec74-4909-8b06-4d0eb6b82718",
// ╠═╡   "9b149216-2ed6-4ff0-ac83-bff721613f5a",
// ╠═╡   "3040d168-18f8-478e-af27-a93db12c1493",
// ╠═╡   "83d6c607-46fa-446a-9bb5-b019fc626f2e"
// ╠═╡ ]
