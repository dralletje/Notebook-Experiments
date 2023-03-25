import React from "react";

export let Child = () => {
  React.useMemo(() => {
    console.log("useMemo in child component");
  }, []);
  return <div>hi</div>;
};

export let useChildMemo = () => {
  React.useMemo(() => {
    console.log("useMemo in child hook");
  }, []);
};
