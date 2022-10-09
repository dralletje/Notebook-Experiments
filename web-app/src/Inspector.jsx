import React from "react";
import styled from "styled-components";
import { Inspector as BasicInspector } from "inspector-x-react";
import "@observablehq/inspector/src/style.css";

let InspectorStyle = styled.div`
  --syntax_normal: #848484;
  --syntax_comment: #a9b0bc;
  --syntax_number: #20a5ba;
  --syntax_keyword: #c30771;
  --syntax_atom: #10a778;
  --syntax_string: #008ec4;
  --syntax_error: #ffbedc;
  --syntax_unknown_variable: #838383;
  --syntax_known_variable: #005f87;
  --syntax_matchbracket: #20bbfc;
  --syntax_key: #6636b4;

  display: contents;

  & svg {
    display: inline;
  }

  /* For some, weird reason, this rule isn't 
            in the open source version */
  & .observablehq--caret {
    margin-right: 4px;
    vertical-align: baseline;
  }

  & .observablehq--inspect {
    /* Makes the whole inspector flow like text */
    display: inline;
    font-size: 16px;
  }
  /* Add a gimmicky javascript logo */
  & .observablehq--inspect.observablehq--collapsed > a::before,
  & .observablehq--inspect:not(.observablehq--collapsed)::before,
  & .observablehq--running::before {
    all: initial;
    content: "JS";
    color: #323330;
    background-color: #f0db4f;
    display: inline-block;
    padding-left: 4px;
    padding-right: 4px;
    padding-top: 3px;
    padding-bottom: 2px;
    margin-right: 8px;
    font-size: 14px;
    font-family: "Roboto Mono";
    font-weight: bold;
    margin-bottom: 3px;

    /* Hmmm, undo the logo sorry sorry */
    content: unset;
  }
`;

export let Inspector = ({ value }) => {
  return (
    <InspectorStyle>
      <BasicInspector value={value} />
    </InspectorStyle>
  );
};
