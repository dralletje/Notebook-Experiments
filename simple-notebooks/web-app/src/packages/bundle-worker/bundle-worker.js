export let get_bundle_worker = () => {
  let worker = new Worker(new URL("./bundle-worker-worker", import.meta.url), {
    type: "module",
  });

  worker.onerror = (event) => {
    console.error(event.message);
  };

  return worker;
};
