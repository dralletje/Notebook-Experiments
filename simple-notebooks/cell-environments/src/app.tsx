// ╔═╡ DRAL_NOTEBOOK_VERSION = "0.0.1"
export {};

// ╔═╡ [cells.c372df60-f0f0-4480-882e-5d0918452837]
// ╠═╡ folded = false
x = await new Promise((resolve) =>
  setTimeout(resolve, 1000)
);

// ╔═╡ [cells.6f02384d-2362-4167-92ca-ef2f5707d375]
// ╠═╡ type = "text"
// # My Notebook!
// Pretty cool, huh?
// Type markdown in a natural way, write code without restrictions.

// ╔═╡ [cells.21227430-c866-4c20-a0a3-c48047edbadf]
// ╠═╡ folded = false
y = await new Promise(
  (resolve) => (x, setTimeout(resolve, 10000))
);

// ╔═╡ [cells.4578b1f8-fc43-4812-9b5a-cb9580937a54]
// ╠═╡ folded = false
z = await new Promise(
  (resolve) => (y, setTimeout(resolve, 10000))
);

// ╔═╡ [cells.7402e9a0-0e82-4741-8a24-1e55d94056aa]
// ╠═╡ folded = false
1 + 1

// ╔═╡ ["Cell Order"]
// ╠═╡ "Cell Order" = [
// ╠═╡   "6f02384d-2362-4167-92ca-ef2f5707d375",
// ╠═╡   "21227430-c866-4c20-a0a3-c48047edbadf",
// ╠═╡   "c372df60-f0f0-4480-882e-5d0918452837",
// ╠═╡   "4578b1f8-fc43-4812-9b5a-cb9580937a54",
// ╠═╡   "7402e9a0-0e82-4741-8a24-1e55d94056aa"
// ╠═╡ ]


