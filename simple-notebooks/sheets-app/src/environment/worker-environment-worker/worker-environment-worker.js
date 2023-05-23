export let get_worker_environment_worker = () => {
  let worker = new Worker(
    new URL("./worker-environment-worker-worker", import.meta.url),
    {
      type: "module",
    }
  );

  worker.onerror = (event) => {
    console.error(event);
  };

  return worker;
};
