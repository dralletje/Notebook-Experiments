# Notebook Experiments for Notebook Scientists

This is currently mainly used for my codemirror-editorstate-in-editorstate experiment.
Was hoping to make it a bit less heavy on abstraction, but I think this abstraction is very necessary.

After this abstraction is done and stable, I can do a lot more experiments.

## Current Todo

- Send whole workspace to the engine, so it can run all the notebooks and keep their results.
  (Possibly send `run_at=null` for cells that are not in the currently open notebook?)
- Send cells that are in view to the engine so it can prioritize these and run other cells later.
  (This will update even during execution, so when scrolling after page load, it should update as you scroll)

## Useful links

- [Codemirror Reference](https://codemirror.net/docs/ref/)
- [Codemirror System Guide](https://codemirror.net/docs/guide/)
- [Typescript In Worker Example (very useful to steal from)](https://codesandbox.io/s/github/danilowoz/sandpack-tsserver?file=/public/workers/tsserver.js)

- [@codemirror/state Github](https://github.com/codemirror/state/blob/main/src/state.ts)
