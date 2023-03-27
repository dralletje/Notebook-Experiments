import React from "react";

export let Sidebar = ({ editor_in_chief }) => {
  console.log(`editor_in_chief:`, editor_in_chief);
  return (
    <React.Fragment>
      <div className="bg-stone-900 flex-1"></div>
      <div className="bg-stone-0" style={{ width: 50 }}></div>
    </React.Fragment>
  );
};
