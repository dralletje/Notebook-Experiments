import React from "react";
import styled from "styled-components";

export let DropdownLink = styled.a``;

export let BrutalButton = styled.button`
  border: none;
  height: 100%;
  padding: 0 8px;
  font-weight: normal;

  body:not(.mouse-down) &:hover {
    background-color: white;
    color: black;
  }
`;

let DropdownDialog = styled.div`
  position: relative;
  top: 100%;
  left: 0;

  flex-direction: row;

  .menu {
    display: flex;
    background-color: black;
    min-width: 150px;
    font-size: 16px;

    flex-direction: column;

    border: solid 4px white;

    ${DropdownLink} {
      padding: 8px 16px;
      white-space: pre;
      cursor: pointer;
      font-family: var(--mono-font-family);

      border-top: solid white 2px;
      &:first-child {
        border-top: none;
      }

      &.active {
        cursor: unset;
        color: #37ff61;
        font-weight: bold;
        background-color: #323232;
      }

      &:not(.active):hover {
        background-color: white;
        color: black;
      }
    }
  }

  .help {
    width: 300px;
    background-color: black;
    font-size: 16px;
    padding: 16px;
    border: solid 4px white;
    border-left: none;
  }
`;

/** @param {{ details: React.ReactNode, actions: React.ReactNode }} props */
export let Dropdown = ({ details, actions }) => {
  return (
    <BrutalButton>
      <DropdownDialog>
        <div className="menu">{actions}</div>

        <div className="help">{details}</div>
      </DropdownDialog>
    </BrutalButton>
  );
};
