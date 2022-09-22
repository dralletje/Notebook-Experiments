import React, { useLayoutEffect, useRef, useMemo } from "react";
import { takeWhile, zip } from "lodash";
import styled from "styled-components";

import { EditorState, Compartment, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useDidJustHotReload, useRealMemo } from "use-real-memo";

/** @type {React.Context<(...spec: any[]) => void>} */
let codemirror_editorview_context = React.createContext(
  /** @type {any} */ (null)
);

let Container = styled.div`
  height: 100%;
  display: contents;

  & .cm-editor .cm-content,
  & .cm-editor .cm-scroller,
  & .cm-editor .cm-tooltip-autocomplete .cm-completionLabel {
    font-family: inherit;
  }

  & .cm-editor .cm-content {
    padding: 2px 0px;
  }

  &:focus-within .cm-editor .cm-matchingBracket {
    color: var(--cm-matchingBracket-color) !important;
    font-weight: 700;
    background-color: var(--cm-matchingBracket-bg-color);
    border-radius: 2px;
  }

  & .cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li {
    height: unset;
  }

  & .cm-editor .cm-selectionBackground {
    background: var(--cm-selection-background-blurred);
  }
  & .cm-editor.cm-focused .cm-selectionBackground {
    background: var(--cm-selection-background);
  }

  & .cm-editor {
    color: var(--cm-editor-text-color);
  }
  & .cm-editor.cm-focused:not(.__) {
    outline: unset;
  }

  & .cm-selectionMatch {
    background: none !important;
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
  }
  @media (prefers-color-scheme: dark) {
    & .cm-selectionMatch {
      background: none !important;
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
    }
  }

  & .cm-editor .cm-matchingBracket,
  & .cm-editor .cm-nonmatchingBracket {
    background-color: unset;
    color: unset;
  }

  & .cm-editor .cm-placeholder {
    color: var(--cm-placeholder-text-color);
    font-style: italic;
  }

  /* HEYYYYY */
  & .cm-editor {
    height: 100%;
  }

  & .cm-cursor {
    border-left-color: #dcdcdc !important;
  }
`;

// /**
//  * @param {(tr: import("@codemirror/state").Transaction) => void} dispatch
//  * @param {import("@codemirror/state").Extension} extension
//  */
// let useCodemirrorExtension = (dispatch, extension) => {
//   let compartment = useRef(new Compartment()).current;
//   let initial_value = useRef(compartment.of(extension)); // TODO? Can move this inside the useLayoutEffect?

//   useLayoutEffect(() => {
//     dispatch_ref.current({
//       effects: StateEffect.appendConfig.of(initial_value.current),
//     });
//     return () => {
//       dispatch_ref.current({
//         // @ts-ignore
//         effects: compartment.reconfigure(null),
//       });
//     };
//   }, []);

//   useLayoutEffect(() => {
//     dispatch_ref.current?.({
//       effects: compartment.reconfigure(extension),
//     });
//   }, deps);
// };

export let CodeMirror = React.forwardRef(
  /**
   * @param {{
   *  children: React.ReactNode,
   *  as?: string,
   *  state: Exclude<import("@codemirror/view").EditorViewConfig["state"], void>,
   *  root?: import("@codemirror/view").EditorViewConfig["root"],
   *  dispatch?: (tr: import("@codemirror/state").Transaction) => void,
   * } & import("react").HtmlHTMLAttributes<"div">} editor_props
   * @param {React.Ref<EditorView>} _ref
   */
  (
    { state, children, as = "codemirror-editor", dispatch, root, ...props },
    _ref
  ) => {
    /** @type {React.MutableRefObject<HTMLDivElement>} */
    let dom_node_ref = React.useRef(/** @type {any} */ (null));

    /** @type {React.MutableRefObject<EditorView>} */
    let editorview_ref = React.useRef(/** @type {any} */ (null));
    React.useImperativeHandle(_ref, () => editorview_ref.current);

    let view = useBareView({
      state,
      dispatch:
        dispatch ??
        ((transaction) => editorview_ref.current.update([transaction])),
    });

    React.useLayoutEffect(() => {
      let editorview = new EditorView({
        state: view.state,
        parent: dom_node_ref.current,
        root: root,
        dispatch: (tr) => {
          view.dispatch(tr);
        },
      });
      editorview_ref.current = editorview;

      return () => {
        editorview_ref.current = /** @type {any} */ (null);
        editorview.destroy();
      };
    }, [dom_node_ref, state]);

    // return (
    //   <Container {...props} ref={dom_node_ref}>
    //     <codemirror_editorview_context.Provider value={dispatch_ref}>
    //       {children}
    //     </codemirror_editorview_context.Provider>
    //   </Container>
    // );
    // The above but with the JSX transpiled to React.createElement calls
    return React.createElement(
      Container,
      { ...props, ref: dom_node_ref },
      React.createElement(
        codemirror_editorview_context.Provider,
        { value: view.dispatch },
        children
        // null
      )
    );
  }
);

/**
 * @param {{
 *  extension: import("@codemirror/state").Extension,
 *  deps?: any[],
 * }} props
 */
export let Extension = ({
  extension: extension_unmemod,
  deps = [extension_unmemod],
}) => {
  let dispatch = React.useContext(codemirror_editorview_context);

  let compartment = useRef(new Compartment()).current;

  let extension = useMemo(() => extension_unmemod, deps);

  useLayoutEffect(() => {
    // TODO Maybe make this not use dispatch, but something specifically for
    // .... adding extensions the first time? So codemirror doesn't get all these StateEffect.appendConfig's?
    dispatch({
      effects: StateEffect.appendConfig.of(compartment.of(extension)),
    });
    return () => {
      dispatch({
        // @ts-ignore
        effects: compartment.reconfigure(null),
      });
    };
  }, [dispatch]);

  // TODO Ideally I'd use the compartment.get(editorstate) to confirm I am not updating the
  // .... extension unnecessarily, but I don't have access to the editorstate here (yet).
  // .... So for now I need an extra ref to prevent at least the first reconfigure.
  let did_mount = React.useMemo(() => ({ current: false }), [dispatch]);
  useLayoutEffect(() => {
    if (!did_mount.current) {
      did_mount.current = true;
      return;
    }

    // console.log("RECONFIGURING", { extension, deps });
    dispatch({
      effects: compartment.reconfigure(extension),
    });
  }, [extension, dispatch]);

  return null;
};

let useImmediateRerenderCounter = () => {
  let ref = React.useRef(-1);
  // ref.current = ref.current + 1;
  React.useLayoutEffect(() => {
    ref.current = -1;
  });
  return ref;
};

/**
 * @typedef GenericUpdate
 * @type {{
 *  transactions: import("@codemirror/state").Transaction[],
 *  view: {
 *    state: EditorState;
 *    dispatch: (...tr: import("@codemirror/state").TransactionSpec[]) => void;
 *  },
 *  startState: import("@codemirror/state").EditorState,
 *  state: import("@codemirror/state").EditorState,
 * }}
 */

/**
 * @param {{ [key: string]: import("@codemirror/state").Extension }} extensions
 */
let useExtensionReconfigures = (extensions) => {
  /**
   * @type {React.MutableRefObject<{
   *  [key: string]: { compartment: import("@codemirror/state").Compartment, extension: import("@codemirror/state").Extension }
   * }>}
   */
  let compartment_map = React.useRef({});
};

/**
 * # useBareView
 *
 * This is a hook that can be used instead (or in addition) to
 *
 * @param {{
 *  state: import("@codemirror/state").EditorState,
 *  dispatch: (transaction: import("@codemirror/state").Transaction) => void;
 * }} props
 */
export let useBareView = ({ state: initial_state, dispatch }) => {
  // let initial_extensions_ref = React.useRef(extensions);
  // let previous_extensions_ref = React.useRef(extensions);

  // let did_just_hot_reload = useDidJustHotReload();
  // if (previous_extensions_ref.current.length !== extensions.length) {
  //   if (did_just_hot_reload) {
  //     // Allowing changing amount of extension during hot-reload,
  //     // will totally reload the editor then (which is fine during hot-reload)
  //     initial_extensions_ref.current = extensions;
  //     previous_extensions_ref.current = extensions;
  //   } else {
  //     // prettier-ignore
  //     throw new Error(`Can't change the amount of extensions in useCodemirrorEditorviewWithExtensions`);
  //   }
  // }
  // let initial_extensions = initial_extensions_ref.current;

  // Above is just to make it easier to hot-reload and give nice errors when you change the amount of extensions at runtime
  // What follows is the actual extension 🙃

  // let compartments = useRealMemo(() => {
  //   return initial_extensions.map((extension) => new Compartment());
  // }, [initial_extensions]);

  // let initial_notebook_transaction = useRealMemo(() => {
  //   return EditorState.create({
  //     doc,
  //     selection,
  //     extensions: zip(compartments, initial_extensions).map(
  //       // @ts-ignore trust me, `compartments` and `extensions` are the same length
  //       ([compartment, extension]) => compartment.of(extension)
  //     ),
  //   }).update({});
  // }, [compartments]);

  let [state, set_state] = React.useState(initial_state);

  // // prettier-ignore
  // { // HOT RELOADING TWEAK - I hate myself but I am too far in now
  //   let last_initial_notebook_transaction_ref = React.useRef(initial_notebook_transaction)
  //   if (last_initial_notebook_transaction_ref.current !== initial_notebook_transaction) {
  //     set_notebook_transaction(initial_notebook_transaction)
  //     last_initial_notebook_transaction_ref.current = initial_notebook_transaction
  //   }
  // } // END HOT RELOADING TWEAK

  //   let reconfigures = compact(
  //     zip(compartments, extensions, previous_extensions_ref.current).map(
  //       ([compartment, extension, previous_extension]) => {
  //         if (extension !== previous_extension) {
  //           // @ts-ignore
  //           return compartment.reconfigure(extension);
  //         } else {
  //           return null;
  //         }
  //       }
  //     )
  //   );
  //   let reconfigures_counter = useImmediateRerenderCounter();
  //   if (reconfigures.length > 0) {
  //     // PREVENT AN INFINITE LOOP BECAUSE OF "UNSTABLE" EXTENSIONS
  //     {
  //       if (reconfigures_counter.current > 10) {
  //         let indexes_that_changed = compact(
  //           zip(extensions, previous_extensions_ref.current).map(
  //             ([extension, previous_extension], index) =>
  //               extension !== previous_extension ? index : null
  //           )
  //         );
  //         // prettier-ignore
  //         throw new Error(`
  // Seems like one of the extensions you passed to useNotebookviewWithExtensions is unstable (changes every render), causing an infinite loop.
  // You likely want to wrap that extension in a React.useMemo() call.
  // (The extensions that changed are at index ${indexes_that_changed.join(", ")} in the extensions array you passed to useNotebookviewWithExtensions)`);
  //       }
  //       reconfigures_counter.current++;
  //     }

  //     // Recently learned that it is _OK_ to put a setState in render?
  //     // It still runs this function, but will discard everything and re-run, which is what I want.
  //     set_notebook_transaction(
  //       notebook_transaction.state.update({
  //         effects: reconfigures,
  //       })
  //     );
  //     previous_extensions_ref.current = extensions;
  //   }

  // I feel dirty for using a ref STILL, after all my hard work to get rid of them.
  /** @type {React.MutableRefObject<import("@codemirror/state").Transaction[]>} */
  let transactions_to_apply_ref = React.useRef([]);

  // Used `useEvent` here before, because I wasn't using the setState-render loop to sync the children...
  // Now that is fixed, I don't need the immediate update stuff anymore... don't need any update actually!
  // I think `set_notebook_transaction` is completely stable so... cool 😎
  let notebook_dispatch = React.useCallback(
    (
      /** @type {import("@codemirror/state").TransactionSpec[]} */ ...transaction_specs
    ) => {
      // console.log(`Receiving transaction at nexus:`, transaction_specs);
      if (transaction_specs.length !== 0) {
        // Problem with this state mapper is that multiple calls in the same render will cause the other transactions to be swallowed.
        // So I have to use a ref to store them, and then apply them all in the next render.
        set_state((state) => {
          let transaction = state.update(...transaction_specs);
          transactions_to_apply_ref.current.push(transaction);
          return transaction.state;
        });
      }
    },
    [set_state]
  );

  React.useLayoutEffect(() => {
    // Only of these listeners will do the cell_editor_view.update() calls
    // after a transaction, which is nice! That means the cell_editor_views won't
    // do any dom mutations until this layout effect is done!
    // So everything stays in sync 🤩
    // This _might_ just work with async react.
    // TODO? Maybe the stuff that applies the `cell_editor_view.update()` should be
    // ..... in sync with component it is in, instead of this parent component? Food for thought/improvement.

    // I'm still going to do a premature optimisation here, specifically to avoid applying transactions that
    // React with all it's sync magic, might not have updated the state for yet (aiming at the gap between setState and ref.current = mutation)
    // Not sure if will happen a bit, but I'm in an overengineering mood.
    let transactions_to_apply_now = takeWhile(
      transactions_to_apply_ref.current,
      (transaction) => transaction.startState !== state
    );
    transactions_to_apply_ref.current = transactions_to_apply_ref.current.slice(
      transactions_to_apply_now.length
    );

    for (let transaction of transactions_to_apply_now) {
      dispatch(transaction);
    }
  }, [state]);

  return { state, dispatch: notebook_dispatch };
};
