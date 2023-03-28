// ╔═╡ DRAL_NOTEBOOK_VERSION = "0.0.1"
export {};

// ╔═╡ [cells.c372df60-f0f0-4480-882e-5d0918452837]
// ╠═╡ folded = false
x = await new Promise((resolve) =>
  setTimeout(resolve, 1000)
);

// ╔═╡ [cells.21227430-c866-4c20-a0a3-c48047edbadf]
// ╠═╡ folded = false
y = await new Promise(
  (resolve) => (x, setTimeout(resolve, 5000))
);

// ╔═╡ [cells.3040d168-18f8-478e-af27-a93db12c1493]
// ╠═╡ type = "text"
// ## Markdown todo
// - [ ] **Editing should be awesome**
//   - [ ] Cursor still jumps oddly sometimes because all the moving around of elements I do
//   (Specifically when moving the cursor up or down)
//   - [ ] Related is that I now always put `assoc` to `1` because it _generally_ works better, but I keep finding exceptions D:
//   - [ ] Pressing **<kbd>Enter</kbd> when at the beginning of a block** (just past the marker), should move the marker to the new line. This solves the problem where there is no way to intuitively add a line above a header or list at the top of a cell.
//   - [ ] Figure out what the deal is with **List & Task Markers**.
//   Couple of flows that need to be :sparkles:PERFECT:sparkles:
//     - [ ] <kbd>Enter</pbd>
//     - [ ] <kbd>Shift+Enter</pbd>
//     - [ ] <kbd>Backspace</kbd>
//   - [ ] **Indentation "shouldn't exist"**
//   Only way to interact with it should be with Tab/Shift-Tab, or at least deleting it in chunks of `indentSize`.
// 
// - [ ] Make **links** (and images) work
// I think initially I can make them like text markers now, where they are "just their text" until you are focussed in it.
// _Eventually_ we could _possibly_ add a popup where you can enter the url.
// - [ ] **HTML rendering** makes the document jumpy when it leaves the viewport
// (Because codemirror removes it, but doesn't fill it's space with something)

// ╔═╡ [cells.9b149216-2ed6-4ff0-ac83-bff721613f5a]
// ╠═╡ type = "text"
// ## Editor TODO
// - [ ] **Typechecking/autocomplete**
// Currently I _do_ have a webworker-typescript thingy, and I _could_ use that. But I don't want to! I want to "just" connect to an LSP that has access to all the dependencies and maybe even a `.tsconfig`
//   - Use something like JSPM 
// - [ ] **Sidebar with subnotebooks**
//     - [ ] **Meta notebook**
//     A notebook that can interact with the codemirror instances (and ofcourse, editor-in-chief) to add extensions, theme or CSS.
//     - [ ] **Shell**
//     This one would be so cool. Having a place where you can try small things, interact with your main notebook cells but not the other way around.
// 	- [ ] **Files**
// 	I don't want to! It is too boring!  Eventually there should be some way to manage multiple files, create an environment, blablablabla.
// 

// ╔═╡ [cells.28918307-ec74-4909-8b06-4d0eb6b82718]
// ╠═╡ type = "text"
// 

// ╔═╡ [cells.ef0a0a1a-24ed-4f56-8ba0-7591c1e5d56f]
// ╠═╡ type = "text"
// ## Inline Table editor 
// I eventually want to embed ne asdasdsted editors in cells. A prime example of this could be a table editor, that will actually render a table with individual editable cells (but with all the layout stuff that a table provides)
// 
// - [ ] **Allow editting the editors in the table cells** and it should sync with the codemirror editor. I already kind of have that in checkboxes. The way it is done in checkbox doesn't feel very robust though..
// - [ ] **Focus from parent editor** directly into the child editors, and back! Also something I can first try with checkboxes: ideally, when you "move" into a checkbox, it should be focussed. So when you then press space, it will toggle it.
// - [ ] Ideally, but this is I think a pretty hard one, it should be possible to 
// 
// | Tables   |      Are               |  Cool   |
// | -------- | :-------------:|------:  |
// | col 1 is   |  left-aligned    | $1600 | asdkjas das dasdasd asd \asd asd aasd asd asd asd |
// | col 2 is   |    centered      |   $12    |
// | col 3 is   | right-aligned  |    $1     bjn  |

// ╔═╡ [cells.eed61bda-4174-42e9-a90e-4b0243d7d6f0]
// ╠═╡ type = "text"
// ## Want to show off **Katex support**
// $$
// \begin{align*}
// S(\omega) 
// &= \frac{\alpha g^2}{\omega^5} e^{[ -0.74\bigl\{\frac{\omega U_\omega 19.5}{g}\bigr\}^{\!-4}\,]} \\
// &= \frac{\alpha g^2}{\omega^5} \exp\Bigl[ -0.74\Bigl\{\frac{\omega U_\omega 19.5}{g}\Bigr\}^{\!-4}\,\Bigr] 
// \end{align*}
// $$

// ╔═╡ [cells.6f02384d-2362-4167-92ca-ef2f5707d375]
// ╠═╡ type = "text"
// # My Title is Awesome

// ╔═╡ [cells.4578b1f8-fc43-4812-9b5a-cb9580937a54]
// ╠═╡ folded = true
z = await new Promise(
  (resolve) => (y, setTimeout(resolve, 10000))
);

// ╔═╡ [cells.fc39ad0d-c091-45bf-9eec-39648777b973]
// ╠═╡ folded = true
import {
  add,
  compact,
  zip,
  without,
  merge,
  mergeWith,
} from "lodash-es";

// ╔═╡ [cells.7402e9a0-0e82-4741-8a24-1e55d94056aa]
// ╠═╡ folded = false
1 + 1

// ╔═╡ ["Cell Order"]
// ╠═╡ "Cell Order" = [
// ╠═╡   "6f02384d-2362-4167-92ca-ef2f5707d375",
// ╠═╡   "eed61bda-4174-42e9-a90e-4b0243d7d6f0",
// ╠═╡   "ef0a0a1a-24ed-4f56-8ba0-7591c1e5d56f",
// ╠═╡   "28918307-ec74-4909-8b06-4d0eb6b82718",
// ╠═╡   "9b149216-2ed6-4ff0-ac83-bff721613f5a",
// ╠═╡   "3040d168-18f8-478e-af27-a93db12c1493",
// ╠═╡   "4578b1f8-fc43-4812-9b5a-cb9580937a54",
// ╠═╡   "fc39ad0d-c091-45bf-9eec-39648777b973",
// ╠═╡   "21227430-c866-4c20-a0a3-c48047edbadf",
// ╠═╡   "c372df60-f0f0-4480-882e-5d0918452837",
// ╠═╡   "7402e9a0-0e82-4741-8a24-1e55d94056aa"
// ╠═╡ ]


