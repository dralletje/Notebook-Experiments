import React, { useLayoutEffect, useRef, useMemo } from "react";
import { Compartment, StateEffect, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** @type {React.Context<(...spec: any[]) => void>} */
let codemirror_editorview_context = React.createContext(
  /** @type {any} */ (null)
);

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

function useEvent(handler) {
  const handlerRef = React.useRef((...args) => {});

  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return React.useCallback((...args) => {
    return handlerRef.current(...args);
  }, []);
}
// function useEvent(handler) {
//   const handlerRef = React.useRef(handler);

//   // Pretty sure setting this in render does break things,
//   // but it is not like I have another option :/
//   handlerRef.current = handler;

//   return React.useCallback((...args) => {
//     return handlerRef.current(...args);
//   }, []);
// }

export let CodeMirror = React.forwardRef(
  /**
   * @param {{
   *  children?: React.ReactNode,
   *  as?: string,
   *  state: import("@codemirror/view").EditorViewConfig["state"],
   *  root?: import("@codemirror/view").EditorViewConfig["root"],
   *  dispatch?: (tr: import("@codemirror/state").TransactionSpec[], view: EditorView) => void,
   * } & import("react").HtmlHTMLAttributes<"div">} editor_props
   * @param {React.Ref<EditorView>} _ref
   */
  (
    { state, children, as = "codemirror-container", dispatch, root, ...props },
    _ref
  ) => {
    /** @type {React.MutableRefObject<HTMLDivElement>} */
    let dom_node_ref = React.useRef(/** @type {any} */ (null));

    /** @type {React.MutableRefObject<EditorView>} */
    let editorview_ref = React.useRef(/** @type {any} */ (null));
    React.useImperativeHandle(_ref, () => editorview_ref.current);

    /**
     * Batching events, as the first round of "adding extension" and "updating extensions" will run before "our" useLayout can run.
     * (Children's useLayout will run before ours)
     * @type {React.MutableRefObject<Array<any>>}
     */
    let batched_effects_ref = React.useRef([]);
    // prettier-ignore
    let preliminairy_dispatch = React.useCallback((/** @type {import("@codemirror/state").TransactionSpec[]} */ ...spec) => {
      if (editorview_ref.current) {
        editorview_ref.current.dispatch(...spec);
      } else {
        batched_effects_ref.current.push(spec);
      }
    }, [state]);

    // Allow overriding the editorview's dispatch function,
    // but codemirror doesn't allow changing it afterwards so we
    // need to trick codemirror by creating a proxy function,
    // so we can still collect effects before the editorview is created.
    let dispatch_proxy = useEvent(
      /**
       * @param {import("@codemirror/state").TransactionSpec[] | [import("@codemirror/state").Transaction]} transactions
       * @param {EditorView} editorview
       */
      (transactions, editorview) => {
        if (dispatch) {
          return dispatch(transactions, editorview);
        } else {
          return editorview.update([
            transactions.length == 1 && transactions[0] instanceof Transaction
              ? transactions[0]
              : editorview.state.update(...transactions),
          ]);
        }
      }
    );

    React.useLayoutEffect(() => {
      let editorview = editorview_ref.current;

      // Apply effects we have collected before this mount (dispatches from child <Extension /> components)
      // Important to send them in one dispatch, as they are supposed to be non-sequential
      // (Also, my nexus setup fails when they are send in multiple dispatches)
      editorview.dispatch(...batched_effects_ref.current.flat());
      batched_effects_ref.current = [];

      return () => {
        // In the very very peculiar case that I actually want to change the `state` without completely unmounting the component,
        // I again make `dispatch` go to `batched_effects`
        batched_effects_ref.current = [];
        editorview_ref.current = /** @type {any} */ (null);
        editorview.destroy();
      };
    }, [dom_node_ref, state]);

    let set_dom_node_ref_and_create_editorview = (ref) => {
      dom_node_ref.current = ref;

      // I create the edtorview here, because I need `editorview_ref.current` to be set ASAP,
      // not sure why, but running it in the `useLayoutEffect` above doesn't make it work with `useImperativeHandle` quick enough.
      if (editorview_ref.current == null) {
        try {
          let editorview = new EditorView({
            state: state,
            parent: ref,
          });
          // NOTE: HACKY
          // Overrides the dispatch method, because I need access to the dispatched TransactionSpec's,
          // instead of getting the spec already applied to the current state in the form of a Transaction.
          // The reason is that I don't update the state immediately (I stay in sync with React),
          // but `view.dispatch` will update the state immediately...
          // I hope this doesn't break anything? Hehehe
          /** @param {import("@codemirror/state").TransactionSpec[] | [import("@codemirror/state").Transaction]} transactions */
          editorview.dispatch = (...transactions) => {
            dispatch_proxy(transactions, editorview);
          };
          editorview_ref.current = editorview;
        } catch (error) {
          console.error("COULDN'T CREATE EDITORVIEW", error.stack);
        }
      }
    };

    // return (
    //   <Container {...props} ref={set_dom_node_ref_and_create_editorview}>
    //     <codemirror_editorview_context.Provider value={dispatch_ref}>
    //       {children}
    //     </codemirror_editorview_context.Provider>
    //   </Container>
    // );
    // The above but with the JSX transpiled to React.createElement calls
    return React.createElement(
      as,
      {
        ...props,
        style: { display: "contents", ...props.style },
        ref: set_dom_node_ref_and_create_editorview,
      },
      React.createElement(
        codemirror_editorview_context.Provider,
        { value: preliminairy_dispatch },
        children
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
    dispatch({
      effects: StateEffect.appendConfig.of(compartment.of(extension)),
    });
    return () => {
      dispatch({
        effects: compartment.reconfigure([]),
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
