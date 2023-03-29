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

// ╔═╡ ["Cell Order"]
// ╠═╡ "Cell Order" = [
// ╠═╡   "6f02384d-2362-4167-92ca-ef2f5707d375",
// ╠═╡   "87b3328c-a47d-4431-934c-67289b534115",
// ╠═╡   "980db4ac-bac3-47c7-a559-845b3d455821",
// ╠═╡   "9a8fc483-556b-40d0-8026-a6eb83127449",
// ╠═╡   "3832e250-b538-4856-a496-106b217a8473",
// ╠═╡   "0d236e53-7f21-413b-b8e7-d2a4f2c88ab8",
// ╠═╡ ]
