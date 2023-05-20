type Cell = {
  id: string;
  code: string;
  css_to_apply: string;
  disabled?: boolean;
  collapsed?: boolean;
  name?: string;
};

type PaintbrushIframeCommandMap = {
  highlight_selector: {
    input: { selector: string | undefined };
    output: void;
  };
  save: {
    input: { cells: Cell[] };
    output: void;
  };
  "toggle-horizontal-position": { input: void; output: void };
  css: {
    input: { code: string };
    output: void;
  };
  "apply-new-css": { input: { sheets: Cell[] }; output: void };
  load: {
    input: void;
    output: Cell[];
  };
  ready: { input: void; output: void };
  close: { input: void; output: void };
  reload: { input: void; output: void };
  "get-css-variables": {
    input: {};
    output: { variables: { key: string; value: string }[] };
  };
};

let message_counter = 1;

/**
 * `window.parent.postMessage` but with types so
 * I know I am not screwing things up too much.
 */
export let call_extension = <K extends keyof PaintbrushIframeCommandMap>(
  type: K,
  argument?: PaintbrushIframeCommandMap[K]["input"]
): Promise<PaintbrushIframeCommandMap[K]["output"]> => {
  let message_id = message_counter++;
  window.parent.postMessage(
    {
      ...argument,
      type: type,
      message_id: message_id,
    },
    "*"
  );

  return new Promise((resolve) => {
    window.addEventListener("message", function listener(event) {
      if (event.source !== window.parent) return;
      if (
        event.data.type === "response" &&
        event.data.message_id === message_id
      ) {
        window.removeEventListener("message", listener);
        resolve(event.data.result);
      }
    });
  });
};
