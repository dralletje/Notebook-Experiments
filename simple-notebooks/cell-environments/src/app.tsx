// ╔═╡ DRAL_NOTEBOOK_VERSION = "0.0.1"
export {};

// ╔═╡ [cells.c372df60-f0f0-4480-882e-5d0918452837]
// ╠═╡ folded = false
x = await new Promise((resolve) =>
  setTimeout(resolve, 1000)
);

// ╔═╡ [cells.bfd916a3-3996-4ea7-b87c-555e19387e3c]
// ╠═╡ type = "text"
// - [ ] **Typechecking/autocomplete**
// Currently I _do_ have a webworker-typescript thingy, and I _could_ use that.
// But I don't want to! I want to "just" connect to an LSP that has access to
// all the dependencies and maybe even a a`.tsconfig`.
// - [ ] **Sidebar with subnotebooks**
// 	- [ ] **Meta notebook**
// 	A notebook that can interact with the codemirror instances (and ofcourse, editor-in-chief)
// 	to add extensions, theme or CSS. 
// 	- [ ] **Shell**
// 	This one would be so cool. Having a place where you can try small things, interact with your
// 	main notebook cells but not the other way around.
// 	- [ ] **Files**
// 	I don't want to! It is too boring!  
// 	Eventually there should be some way to manage multiple files, create an environment,
// 	blablablabla.

// ╔═╡ [cells.b673c31e-9c3f-4bcc-9629-dfd504e8980f]
// ╠═╡ type = "text"
// # H^a^ asdasd kjla sdklajsdkljads kljdas kljasdadasd~h~ aasdkj
// 
// [asd](http://google.com)
// 
// ```
// Hey there
// ```

// ╔═╡ [cells.6f02384d-2362-4167-92ca-ef2f5707d375]
// ╠═╡ type = "text"
// # My Notebook!
// Pretty cool, huh?
// Type markdown in a natural way, write code without restrictions. `x + 10` a

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
// ╠═╡   "b673c31e-9c3f-4bcc-9629-dfd504e8980f",
// ╠═╡   "bfd916a3-3996-4ea7-b87c-555e19387e3c",
// ╠═╡   "21227430-c866-4c20-a0a3-c48047edbadf",
// ╠═╡   "c372df60-f0f0-4480-882e-5d0918452837",
// ╠═╡   "4578b1f8-fc43-4812-9b5a-cb9580937a54",
// ╠═╡   "7402e9a0-0e82-4741-8a24-1e55d94056aa"
// ╠═╡ ]


