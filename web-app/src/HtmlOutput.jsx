import React from "react";

export let HtmlOutput = ({ html }) => {
  return (
    <div
      className="HtmlOutput"
      dangerouslySetInnerHTML={{ __html: html }}
    ></div>
  );
};
