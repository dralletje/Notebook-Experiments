export let DEFAULT_WORKSPACE =
  '{"id":"workspace-id?","files":{"app.ts":{"filename":"app.ts","notebook":{"id":"app.ts","filename":"app.ts","cell_order":["d976eea4-7a87-4561-b7d7-4ba7a0bfb864","7e015a99-3340-448f-8044-459c2f05cb2f","02c80410-1ba9-4ebe-874a-90922d490bc8","eabcea0b-13dc-49f2-ad85-30517ecdc69a","30d98fc2-9abb-4234-a0b9-1c39f366dcd6","484445c2-acc6-470b-8649-f31792d29962","d4142191-b34d-4183-bbf5-ffcbcaebaa35","850efdcf-2311-4fb6-bfa4-333e4a4d4f71","4c0951c0-d14d-47c5-a105-d6bbf27f50aa"],"cells":{"d976eea4-7a87-4561-b7d7-4ba7a0bfb864":{"id":"d976eea4-7a87-4561-b7d7-4ba7a0bfb864","unsaved_code":"# Javascript Notebooks!\\n_still need to find a good name_\\n\\nThese notebooks are inspired by [Pluto.jl](https://plutojl.org/) and [Observable](https://observablehq.com/) - allowing you to write javascript quickly, beautifully and without distractions. Code doesn\'t have to be in order.\\n\\n## Quickstart\\nStart writing your code in one of the cells below, I\'ve written some example code to give you a feel for what you can do.\\n- **Create a new cell** by pressing <kbd>Enter</kbd> three times or right-clicking to left of a cell. A context menu will popup to let you create cell ex-nihilo.\\n- **Run a cell** by pressing <kbd>Shift-Enter</kbd> or **run and create a new cell** by pressing <kbd>Cmd-Enter</kbd>.\\n- **Fold a cell** by clicking to the left of it, **drag a cell** by click and dragging that same area.\\n- **Edit text** by clicking and typing! It is an experimental WYSIWYG editor, I hope you like it.","code":"# Javascript Notebooks!\\n_still need to find a good name_\\n\\nThese notebooks are inspired by [Pluto.jl](https://plutojl.org/) and [Observable](https://observablehq.com/) - allowing you to write javascript quickly, beautifully and without distractions. Code doesn\'t have to be in order.\\n\\n## Quickstart\\nStart writing your code in one of the cells below, I\'ve written some example code to give you a feel for what you can do.\\n- **Create a new cell** by pressing <kbd>Enter</kbd> three times or right-clicking to left of a cell. A context menu will popup to let you create cell ex-nihilo.\\n- **Run a cell** by pressing <kbd>Shift-Enter</kbd> or **run and create a new cell** by pressing <kbd>Cmd-Enter</kbd>.\\n- **Fold a cell** by clicking to the left of it, **drag a cell** by click and dragging that same area.\\n- **Edit text** by clicking and typing! It is an experimental WYSIWYG editor, I hope you like it.","requested_run_time":0,"type":"text"},"7e015a99-3340-448f-8044-459c2f05cb2f":{"id":"7e015a99-3340-448f-8044-459c2f05cb2f","unsaved_code":"let images = await(\\n  await fetch(\\n    \\"https://fakerapi.it/api/v1/images?_width=380\\"\\n  )\\n).json();","code":"let images = await(\\n  await fetch(\\n    \\"https://fakerapi.it/api/v1/images?_width=380\\"\\n  )\\n).json();","is_waiting":true,"requested_run_time":1680201537527,"folded":false,"type":"code"},"484445c2-acc6-470b-8649-f31792d29962":{"id":"484445c2-acc6-470b-8649-f31792d29962","unsaved_code":"import React from \\"react\\";","code":"import React from \\"react\\";","is_waiting":true,"requested_run_time":1680200409719,"folded":true,"type":"code"},"30d98fc2-9abb-4234-a0b9-1c39f366dcd6":{"id":"30d98fc2-9abb-4234-a0b9-1c39f366dcd6","unsaved_code":"## Some notes\\n- All cells are formatted with prettier automatically. You can\'t disable this.\\n- Code is saved in localstorage. \\n- **Code runs in the browser**, so you can\'t `fetch` everything, CORS rules apply :sweat:\\n- Dependencies are fetched from [JSPM](https://jspm.dev), which works but _i think_ doesn\'t dedupe dependencies between them.\\n- Currently, code does **not run in the webpage**. It now runs a WebWorker, so there is no way to actually work with elements. To help a bit I\'ve added `html` and `md` helpers (like those in Pluto.jl or Observable) and added JSX support. You still have to `import React from \\"react\\"` yourself, and you can\'t actually do something dynamic.","code":"## Some notes\\n- All cells are formatted with prettier automatically. You can\'t disable this.\\n- Code is saved in localstorage. \\n- **Code runs in the browser**, so you can\'t `fetch` everything, CORS rules apply :sweat:\\n- Dependencies are fetched from [JSPM](https://jspm.dev), which works but _i think_ doesn\'t dedupe dependencies between them.\\n- Currently, code does **not run in the webpage**. It now runs a WebWorker, so there is no way to actually work with elements. To help a bit I\'ve added `html` and `md` helpers (like those in Pluto.jl or Observable) and added JSX support. You still have to `import React from \\"react\\"` yourself, and you can\'t actually do something dynamic.","requested_run_time":0,"type":"text"},"d4142191-b34d-4183-bbf5-ffcbcaebaa35":{"id":"d4142191-b34d-4183-bbf5-ffcbcaebaa35","unsaved_code":"<div\\n  style={{\\n    borderRadius: \\"50%\\",\\n    backgroundColor: \\"darkred\\",\\n    fontSize: 40,\\n    fontWeight: \\"bold\\",\\n  }}\\n>\\n  WOW\\n</div>;","code":"<div\\n  style={{\\n    borderRadius: \\"50%\\",\\n    backgroundColor: \\"darkred\\",\\n    fontSize: 40,\\n    fontWeight: \\"bold\\",\\n  }}\\n>\\n  WOW\\n</div>;","is_waiting":true,"requested_run_time":1680200808530,"folded":false,"type":"code"},"eabcea0b-13dc-49f2-ad85-30517ecdc69a":{"id":"eabcea0b-13dc-49f2-ad85-30517ecdc69a","unsaved_code":"import _ from \\"lodash\\";","code":"import _ from \\"lodash\\";","is_waiting":true,"requested_run_time":1680200900247,"folded":false,"type":"code"},"02c80410-1ba9-4ebe-874a-90922d490bc8":{"id":"02c80410-1ba9-4ebe-874a-90922d490bc8","unsaved_code":"help_me_find_a_useful_example_please = _.groupBy(\\n  images.data,\\n  (x) => x.title.length\\n);","code":"help_me_find_a_useful_example_please = _.groupBy(\\n  images.data,\\n  (x) => x.title.length\\n);","is_waiting":true,"requested_run_time":1680201671945,"type":"code"},"4c0951c0-d14d-47c5-a105-d6bbf27f50aa":{"id":"4c0951c0-d14d-47c5-a105-d6bbf27f50aa","unsaved_code":"let code_thing = md`Why you wouldn\'t use my **WYSIWYG** editor though :wink:`;\\nhtml`<div style=${{\\n  backgroundColor: \\"darkblue\\",\\n  padding: \\"8px 32px\\",\\n  borderRadius: \\"8px\\",\\n}}><del>${code_thing}</del></div>`;","code":"let code_thing = md`Why you wouldn\'t use my **WYSIWYG** editor though :wink:`;\\nhtml`<div style=${{\\n  backgroundColor: \\"darkblue\\",\\n  padding: \\"8px 32px\\",\\n  borderRadius: \\"8px\\",\\n}}><del>${code_thing}</del></div>`;","is_waiting":true,"requested_run_time":1680202657174,"type":"code"},"850efdcf-2311-4fb6-bfa4-333e4a4d4f71":{"id":"850efdcf-2311-4fb6-bfa4-333e4a4d4f71","unsaved_code":"- `html` here is `htl.html` from Observable\'s [htl](https://github.com/observablehq/htl) packages. So you can put nice interpolations in it and everything","code":"- `html` here is `htl.html` from Observable\'s [htl](https://github.com/observablehq/htl) packages. So you can put nice interpolations in it and everything","requested_run_time":null,"type":"text"}}}}}}';