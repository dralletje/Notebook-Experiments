import React from "react";
import { Child, useChildMemo } from "./child";

export let App = () => {
  React.useMemo(() => {
    console.log("useMemo in parent");
  }, []);
  useChildMemo();
  return <Child />;
};
