export let HTML_MIME_SYMBOL = Symbol("HTML");

export let html = (strings, ...values) => {
  return {
    [HTML_MIME_SYMBOL]: [strings, ...values],
  };
};

export let MARKDOWN_MIME_SYMBOL = Symbol("Markdown");

export let md = (strings, ...values) => {
  return {
    [MARKDOWN_MIME_SYMBOL]: [strings, ...values],
  };
};
