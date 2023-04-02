import React from "react";

/**
 * @returns {[URL, (url: URL | string) => void, (url: URL | string) => void]}
 */
export let useUrl = () => {
  let [url, setUrl] = React.useState(new URL(window.location.href));
  React.useEffect(() => {
    let handler = () => setUrl(new URL(window.location.href));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Also allow setting the URL, including navigation
  let navigate = React.useCallback(
    (/** @type {URL | string} */ url) => {
      let next_url = new URL(url, window.location.href);
      window.history.pushState({}, "", next_url);
      setUrl(next_url);
    },
    [setUrl]
  );

  let navigate_silent = React.useCallback(
    (/** @type {URL | string} */ url) => {
      let next_url = new URL(url, window.location.href);
      window.history.pushState({}, "", next_url);
      setUrl(next_url);
    },
    [setUrl]
  );

  return [url, navigate, navigate_silent];
};

/**
 * @param {string} key
 * @returns {[string | undefined, (value: string | undefined) => void]}
 */
export let useSearchParamState = (key) => {
  let [url, setUrl, setUrlSilent] = useUrl();
  let _dialect = url.searchParams.get(key);
  let dialect = typeof _dialect === "string" ? _dialect : undefined;
  let set_dialect = (dialect) => {
    let new_url = new URL(url);

    if (dialect == null) {
      new_url.searchParams.delete(key);
    } else {
      new_url.searchParams.set(key, dialect);
    }
    setUrlSilent(new_url);
  };

  return [dialect, set_dialect];
};
