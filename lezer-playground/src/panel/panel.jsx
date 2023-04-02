import React from "react";
import styled from "styled-components";
import { IoBonfire } from "react-icons/io5";
import { Failure, Loading } from "../use/OperationMonadBullshit.js";

/**
 * @template T
 * @typedef ExecutionResult
 * @type {import("../use/OperationMonadBullshit.js").ExecutionResult<T>}
 */

// Thanks, https://loading.io/css/
let LoadingRingThing = styled.div`
  --size: 1em;
  --px: calc(var(--size) / 80);

  & {
    display: inline-block;
    position: relative;
    width: calc(80 * var(--px));
    height: calc(80 * var(--px));
  }
  &:after {
    content: " ";
    display: block;
    border-radius: 50%;
    width: 0;
    height: 0;
    margin: calc(8 * var(--px));
    box-sizing: border-box;
    border: calc(32 * var(--px)) solid currentColor;
    border-color: currentColor transparent currentColor transparent;
    animation: lds-hourglass 1.2s infinite;
  }
  @keyframes lds-hourglass {
    0% {
      transform: rotate(0);
      animation-timing-function: cubic-bezier(0.55, 0.055, 0.675, 0.19);
    }
    50% {
      transform: rotate(900deg);
      animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
    }
    100% {
      transform: rotate(1800deg);
    }
  }
`;

// let NOISE_BACKGROUND = new URL(
//   "./noise-backgrounds/asfalt-light.png",
//   import.meta.url
// ).href;
// let NOISE_BACKGROUND =
//   "data:image/png;base64,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";

// Thanks, https://www.cssmatic.com/noise-texture,
// opacity=8%, density=26%, color=white, dimensions=100x100
let NOISE_BACKGROUND = new URL(
  "./noise-backgrounds/img-noise-100x100.png",
  import.meta.url
).href;

export let PaneHeader = styled.div`
  padding-top: 4px;
  padding-bottom: 4px;
  padding-left: 18px;
  padding-right: 5px;
  font-weight: bold;
  font-size: 12px;

  background-color: #ffffff17;
  color: #ffffff75;

  display: flex;
  flex-direction: row;
  align-items: center;

  user-select: none;
`;

export let PaneStyle = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 4px;

  ${PaneHeader}, .cm-panels {
    background-size: 100px 100px;
    background-color: #ffffff17;
    background-image: url("${NOISE_BACKGROUND}");
  }

  .cm-panels {
    color: #ffffff75;
    border-bottom: none;
  }
  .cm-search {
    font-size: 1rem;
    font-family: var(--mono-font-family);

    display: flex;
    flex-direction: row;
    align-items: center;

    [name="select"],
    [name="replace"],
    [name="replaceAll"],
    label {
      display: none;
    }

    input,
    button {
      border: none;
      border-radius: 2px !important;
      font-family: inherit;
    }
    input:focus-visible,
    button:focus-visible {
      outline: 2px #ffffff4f solid;
    }

    [name="search"] {
      flex: 1;
    }

    [name="close"] {
      position: relative !important;
      /* margin-left: 8px !important; */
      margin-left: 4px !important;
      padding-right: 4px !important;
      padding-left: 4px !important;
    }
  }

  .cm-textfield {
    color: white;
    background-color: #0000006b;
  }
  .cm-button {
    background: none;
    background-color: black;
  }

  .cm-content,
  .cm-gutters {
    background-size: 100px 100px;
    background-image: url("${NOISE_BACKGROUND}");

    &.cm-gutters {
      background-position: right;
    }
  }
`;

/**
 * @param {{
 *  title: string,
 *  process?: null | ExecutionResult<any> | Array<ExecutionResult<any>>,
 * }} props
 */
export let PaneTab = ({ title, process }) => {
  let ERROR_COLOR = "rgb(133 0 0)";
  let processes =
    process == null ? [] : Array.isArray(process) ? process : [process];
  let errors = processes.filter((p) => p instanceof Failure);
  let loading = processes.find((p) => p instanceof Loading);

  return (
    <>
      <span style={{ color: errors.length !== 0 ? ERROR_COLOR : undefined }}>
        {title}
      </span>
      {loading != null && (
        <>
          <div style={{ minWidth: 8 }} />
          <LoadingRingThing />
        </>
      )}
      {/* Now slicing the first, gotta make sure I show all the errors but not too much though */}
      {errors.slice(0, 1).map((error, index) => (
        // TODO Using `index` here is wrong, but it doesn't hurt too much
        <React.Fragment key={index}>
          <div style={{ minWidth: 8 }} />
          <IoBonfire style={{ color: ERROR_COLOR }} />
        </React.Fragment>
      ))}
    </>
  );
};

export let Pane = ({ children, header, ...props }) => {
  return (
    <PaneStyle {...props}>
      <PaneHeader>{header}</PaneHeader>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </PaneStyle>
  );
};
