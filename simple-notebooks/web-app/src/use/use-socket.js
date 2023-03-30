import React from "react";
import { io } from "socket.io-client";

export let useSocket = () => {
  let socket = React.useMemo(() => {
    return io("http://localhost:3099", {
      autoConnect: false,
    });
  }, []);
  React.useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    return () => {
      socket.close();
    };
  }, [socket]);
  return socket;
};
