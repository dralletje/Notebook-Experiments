import React from "react";
import { BundleWorker } from "../packages/bundle-worker/bundle-worker.js";

export let useSocket = () => {
  let bundle_worker = React.useMemo(() => {
    return new BundleWorker();
  }, []);
  // React.useEffect(() => {
  //   if (!socket.connected) {
  //     socket.connect();
  //   }
  //   return () => {
  //     socket.close();
  //   };
  // }, [socket]);
  return bundle_worker;
};
