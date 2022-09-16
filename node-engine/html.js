export let HTML_MIME_SYMBOL = Symbol("HTML");

export let html = (strings, ...values) => {
  return {
    [HTML_MIME_SYMBOL]: [strings, ...values],
  };
};
