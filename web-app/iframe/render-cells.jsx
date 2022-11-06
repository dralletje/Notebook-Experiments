import { Inspector } from "../src/Inspector.jsx";
import React from "react";

/** @param {import("../src/notebook-types").CylinderShadow} cylinder */
let Cell = (cylinder) => {
  console.log(`cylinder:`, cylinder);

  return <Inspector value={cylinder.result} />;
};

export let NotebookOutput = ({ cells }) => {
  return <div>Hello!!</div>;
};
