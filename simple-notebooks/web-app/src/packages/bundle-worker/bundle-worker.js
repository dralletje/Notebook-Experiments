export let get_bundle_worker = () => {
  return new Worker(new URL("./bundle-worker-worker", import.meta.url), {
    type: "module",
  });
};
